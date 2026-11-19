import { strToU8, unzipSync, zipSync, strFromU8 } from "fflate";
import type { Result } from "../types";

function decodeXml(value: string): string {
  return value
    .replaceAll("&#10;", "\n")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function columnIndex(ref: string): number {
  const letters = ref.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let number = 0;
  for (const char of letters) number = number * 26 + (char.charCodeAt(0) - 64);
  return number - 1;
}

function columnName(index: number): string {
  let number = index + 1;
  let name = "";
  while (number > 0) {
    const rem = (number - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function xmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;");
}

function readSharedStrings(files: Record<string, Uint8Array>): string[] {
  const key = Object.keys(files).find((name) => name.endsWith("sharedStrings.xml"));
  if (!key) return [];
  const xml = strFromU8(files[key] ?? new Uint8Array());
  const items: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const texts = [...(match[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1] ?? ""));
    items.push(texts.join(""));
  }
  return items;
}

function cellValue(attrs: string, inner: string, shared: string[]): string {
  const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
  if (type === "inlineStr") {
    return [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1] ?? "")).join("");
  }
  const raw = decodeXml(inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "");
  if (type === "s") return shared[Number(raw)] ?? "";
  return raw;
}

function readSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1] ?? "A1";
      row[columnIndex(ref)] = cellValue(attrs, cellMatch[2] ?? "", shared);
    }
    rows.push(row.map((cell) => cell ?? ""));
  }
  return rows;
}

function sheetPath(files: Record<string, Uint8Array>): string | null {
  const relsKey = Object.keys(files).find((name) => name.endsWith("workbook.xml.rels"));
  if (relsKey) {
    const rels = strFromU8(files[relsKey] ?? new Uint8Array());
    const target = rels.match(/worksheets\/sheet\d+\.xml/)?.[0];
    if (target) {
      const full = Object.keys(files).find((name) => name.endsWith(target));
      if (full) return full;
    }
  }
  return Object.keys(files).find((name) => name.endsWith("worksheets/sheet1.xml")) ?? null;
}

export function readXlsxRows(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const path = sheetPath(files);
  if (!path) throw new Error("시트가 없습니다.");
  return readSheet(strFromU8(files[path] ?? new Uint8Array()), readSharedStrings(files));
}

export function readXlsxTable(bytes: Uint8Array): Result<string[][]> {
  try {
    const rows = readXlsxRows(bytes);
    if (rows.length === 0) return { ok: false, error: "표가 비어 있습니다." };
    return { ok: true, data: rows };
  } catch {
    return { ok: false, error: "엑셀 파일을 읽지 못했습니다. 나이스 진도표 xlsx인지 확인해 주세요." };
  }
}

export function buildTableXlsx(rows: string[][]): Uint8Array {
  const strings: string[] = [];
  const indexOf = (value: string) => {
    const found = strings.indexOf(value);
    if (found >= 0) return found;
    strings.push(value);
    return strings.length - 1;
  };
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, column) => {
          const ref = `${columnName(column)}${rowIndex + 1}`;
          return `<c r="${ref}" t="s"><v>${indexOf(value)}</v></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const shared = strings.map((value) => `<si><t xml:space="preserve">${xmlText(value)}</t></si>`).join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="진도표" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`),
    "xl/sharedStrings.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${shared}</sst>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`,
    ),
  };
  return zipSync(files);
}
