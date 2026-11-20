import { unzipSync, strFromU8 } from "fflate";
import type { DocBlock } from "./documentBlocks";
import type { Result } from "../types";

type XmlNode = { name: string; attrs: Record<string, string>; children: Array<XmlNode | string> };

function localName(name: string): string {
  const index = name.indexOf(":");
  return index >= 0 ? name.slice(index + 1) : name;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function findTagEnd(xml: string, start: number): number {
  let quote = "";
  for (let index = start; index < xml.length; index += 1) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index;
  }
  return xml.length;
}

function readAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[match[1] ?? ""] = decodeXml(match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function parseNodes(xml: string, start: number, endParent: string | null): { nodes: Array<XmlNode | string>; index: number } {
  const nodes: Array<XmlNode | string> = [];
  let index = start;
  let textStart = index;
  while (index < xml.length) {
    if (xml[index] !== "<") {
      index += 1;
      continue;
    }
    if (index > textStart) {
      const text = decodeXml(xml.slice(textStart, index));
      if (text) nodes.push(text);
    }
    if (xml.startsWith("<!--", index)) {
      const end = xml.indexOf("-->", index + 4);
      index = end < 0 ? xml.length : end + 3;
      textStart = index;
      continue;
    }
    if (xml.startsWith("<?", index) || xml.startsWith("<!", index)) {
      const end = xml.indexOf(">", index + 2);
      index = end < 0 ? xml.length : end + 1;
      textStart = index;
      continue;
    }
    if (xml.startsWith("</", index)) {
      const end = xml.indexOf(">", index + 2);
      const name = xml.slice(index + 2, end < 0 ? xml.length : end).trim().split(/\s/)[0] ?? "";
      if (endParent && localName(name) === localName(endParent)) {
        return { nodes, index: (end < 0 ? xml.length : end) + 1 };
      }
      index = end < 0 ? xml.length : end + 1;
      textStart = index;
      continue;
    }
    const end = findTagEnd(xml, index + 1);
    const raw = xml.slice(index + 1, end).trim();
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const name = body.match(/^[\w:.-]+/)?.[0] ?? "unknown";
    const node: XmlNode = { name, attrs: readAttrs(body.slice(name.length)), children: [] };
    index = end + 1;
    if (!selfClosing) {
      const inner = parseNodes(xml, index, name);
      node.children = inner.nodes;
      index = inner.index;
    }
    nodes.push(node);
    textStart = index;
  }
  if (textStart < xml.length) {
    const text = decodeXml(xml.slice(textStart));
    if (text) nodes.push(text);
  }
  return { nodes, index: xml.length };
}

function childNodes(node: XmlNode): XmlNode[] {
  return node.children.filter((child): child is XmlNode => typeof child !== "string");
}

function nodeText(node: XmlNode): string {
  let text = "";
  for (const child of node.children) {
    if (typeof child === "string") text += child;
    else if (localName(child.name) === "lineBreak") text += "\n";
    else if (localName(child.name) !== "tbl") text += nodeText(child);
  }
  return text;
}

function paragraphText(node: XmlNode): string {
  let text = "";
  if (localName(node.name) === "t") return nodeText(node);
  if (localName(node.name) === "tbl") return "";
  if (localName(node.name) === "lineBreak") return "\n";
  for (const child of childNodes(node)) text += paragraphText(child);
  return text;
}

function cellParagraphs(node: XmlNode): string[] {
  const lines: string[] = [];
  function visit(current: XmlNode, insideTable: boolean) {
    const name = localName(current.name);
    if (name === "tbl") return;
    if (name === "p" && !insideTable) {
      const text = paragraphText(current).replace(/\u00a0/g, " ").trim();
      if (text) lines.push(text);
      return;
    }
    for (const child of childNodes(current)) visit(child, insideTable || name === "tbl");
  }
  visit(node, false);
  return lines;
}

function cellAddress(node: XmlNode, fallbackCol: number, fallbackRow: number): { col: number; row: number; colSpan: number; rowSpan: number } {
  let col = fallbackCol;
  let row = fallbackRow;
  let colSpan = 1;
  let rowSpan = 1;
  for (const child of childNodes(node)) {
    const name = localName(child.name);
    if (name === "cellAddr") {
      const colAddr = Number(child.attrs.colAddr);
      const rowAddr = Number(child.attrs.rowAddr);
      if (Number.isInteger(colAddr)) col = colAddr;
      if (Number.isInteger(rowAddr)) row = rowAddr;
    }
    if (name === "cellSpan") {
      const spanCol = Number(child.attrs.colSpan);
      const spanRow = Number(child.attrs.rowSpan);
      if (Number.isInteger(spanCol) && spanCol > 0) colSpan = spanCol;
      if (Number.isInteger(spanRow) && spanRow > 0) rowSpan = spanRow;
    }
  }
  return { col, row, colSpan, rowSpan };
}

function tableRows(table: XmlNode): string[][] {
  const grid = new Map<number, Map<number, string>>();
  let fallbackRow = 0;
  let maxCol = 0;
  let maxRow = 0;
  for (const rowNode of childNodes(table)) {
    if (localName(rowNode.name) !== "tr") continue;
    let fallbackCol = 0;
    for (const cell of childNodes(rowNode)) {
      if (localName(cell.name) !== "tc") continue;
      const address = cellAddress(cell, fallbackCol, fallbackRow);
      const text = cellParagraphs(cell).join("\n").trim();
      const row = grid.get(address.row) ?? new Map<number, string>();
      row.set(address.col, text);
      grid.set(address.row, row);
      maxCol = Math.max(maxCol, address.col + address.colSpan - 1);
      maxRow = Math.max(maxRow, address.row + address.rowSpan - 1);
      fallbackCol = address.col + 1;
    }
    fallbackRow += 1;
  }
  const rows: string[][] = [];
  for (let rowIndex = 0; rowIndex <= maxRow; rowIndex += 1) {
    const source = grid.get(rowIndex);
    if (!source) continue;
    const row: string[] = [];
    for (let colIndex = 0; colIndex <= maxCol; colIndex += 1) row.push(source.get(colIndex) ?? "");
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

function containsTable(node: XmlNode): boolean {
  if (localName(node.name) === "tbl") return true;
  return childNodes(node).some(containsTable);
}

function nestedTables(node: XmlNode): XmlNode[] {
  const found: XmlNode[] = [];
  for (const child of childNodes(node)) {
    if (localName(child.name) === "tbl") found.push(child);
    else found.push(...nestedTables(child));
  }
  return found;
}

function blocksFromSection(xml: string): DocBlock[] {
  const parsed = parseNodes(xml, 0, null).nodes;
  const roots = parsed.filter((node): node is XmlNode => typeof node !== "string");
  const blocks: DocBlock[] = [];
  const text: string[] = [];
  function flushText() {
    const joined = text.join("\n").trim();
    text.length = 0;
    if (joined) blocks.push({ kind: "text", text: joined });
  }
  function emitTable(table: XmlNode) {
    flushText();
    const rows = tableRows(table);
    if (rows.length > 0) blocks.push({ kind: "table", rows });
    for (const nested of nestedTables(table)) emitTable(nested);
  }
  function visit(node: XmlNode) {
    const name = localName(node.name);
    if (name === "tbl") {
      emitTable(node);
      return;
    }
    if (name === "p") {
      const line = paragraphText(node).replace(/\u00a0/g, " ").trim();
      if (line) text.push(line);
      for (const child of childNodes(node)) {
        if (containsTable(child)) visit(child);
      }
      return;
    }
    for (const child of childNodes(node)) visit(child);
  }
  for (const root of roots) visit(root);
  flushText();
  return blocks;
}

function sectionKeys(files: Record<string, Uint8Array>): string[] {
  return Object.keys(files)
    .filter((name) => /section\d+\.xml$/i.test(name))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/section(\d+)/i)?.[1] ?? 0);
      const rightNumber = Number(right.match(/section(\d+)/i)?.[1] ?? 0);
      return leftNumber - rightNumber;
    });
}

export function readHwpxBlocks(bytes: Uint8Array): Result<DocBlock[]> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ok: false, error: "HWPX 파일을 열지 못했습니다. 한글에서 HWPX로 저장했는지 확인해 주세요." };
  }
  const sections = sectionKeys(files);
  if (sections.length === 0) {
    const previewKey = Object.keys(files).find((name) => /PrvText\.txt$/i.test(name));
    if (!previewKey) return { ok: false, error: "HWPX 안에서 본문을 찾지 못했습니다." };
    const text = strFromU8(files[previewKey] ?? new Uint8Array()).trim();
    if (!text) return { ok: false, error: "HWPX 안에서 본문을 찾지 못했습니다." };
    return { ok: true, data: [{ kind: "text", text }] };
  }
  const blocks = sections.flatMap((name) => blocksFromSection(strFromU8(files[name] ?? new Uint8Array())));
  return { ok: true, data: blocks };
}
