import type { DocBlock } from "./documentBlocks";
import { layoutPlanTable } from "./pdfTable";
import type { Result } from "../types";

export type PdfGlyph = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type PdfjsModule = {
  getDocument: (src: { data: Uint8Array; isEvalSupported: boolean; useSystemFonts: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
    }>;
  };
};

let pdfjsPromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfjsModule;
      const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs")) as { WorkerMessageHandler?: unknown };
      if (worker.WorkerMessageHandler) {
        (globalThis as { pdfjsWorker?: { WorkerMessageHandler: unknown } }).pdfjsWorker = {
          WorkerMessageHandler: worker.WorkerMessageHandler,
        };
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === "object" && item !== null && "str" in item;
}

export function glyphsToBlocks(glyphs: PdfGlyph[]): DocBlock[] {
  const sorted = glyphs.filter((glyph) => glyph.text.length > 0).sort((left, right) => right.y - left.y || left.x - right.x);
  const lines: PdfGlyph[][] = [];
  for (const glyph of sorted) {
    const line = lines[lines.length - 1];
    const anchor = line?.[0];
    const tolerance = Math.max(2, Math.min(anchor?.height ?? glyph.height, glyph.height) * 0.7);
    if (line && anchor && Math.abs(anchor.y - glyph.y) <= tolerance) line.push(glyph);
    else lines.push([glyph]);
  }

  type Chunk = { text: string; x: number; end: number };
  const rows: Chunk[][] = lines.map((line) => {
    const chunks: Chunk[] = [];
    const height = Math.max(...line.map((glyph) => glyph.height), 12);
    for (const glyph of [...line].sort((left, right) => left.x - right.x)) {
      const width = glyph.width > 0 ? glyph.width : Math.max(height * 0.5, glyph.text.length * height);
      const whitespace = /^\s+$/.test(glyph.text);
      if (whitespace && width > height * 1.5) continue;
      const last = chunks[chunks.length - 1];
      if (last && glyph.x - last.end <= Math.max(height * 1.35, 8)) {
        last.text += glyph.text;
        last.end = Math.max(last.end, glyph.x + width);
        continue;
      }
      if (whitespace) continue;
      chunks.push({ text: glyph.text, x: glyph.x, end: glyph.x + width });
    }
    return chunks.map((chunk) => ({ ...chunk, text: chunk.text.trim() })).filter((chunk) => chunk.text);
  });

  const blocks: DocBlock[] = [];
  let text: string[] = [];
  let table: Chunk[][] = [];

  function flushText() {
    const joined = text.join("\n").trim();
    text = [];
    if (joined) blocks.push({ kind: "text", text: joined });
  }

  function flushTable() {
    if (table.length === 0) return;
    const columns: number[] = [];
    for (const x of table.flatMap((row) => row.map((chunk) => chunk.x)).sort((left, right) => left - right)) {
      const last = columns[columns.length - 1];
      if (last === undefined || x - last > 18) columns.push(x);
    }
    const grid = table.map((row) => {
      const cells = columns.map(() => "");
      for (const chunk of row) {
        let index = 0;
        let best = Number.POSITIVE_INFINITY;
        columns.forEach((column, columnIndex) => {
          const distance = Math.abs(column - chunk.x);
          if (distance < best) {
            best = distance;
            index = columnIndex;
          }
        });
        cells[index] = cells[index] ? `${cells[index]} ${chunk.text}` : chunk.text;
      }
      return cells.map((cell) => cell.trim());
    });
    table = [];
    if (grid.some((row) => row.some(Boolean))) blocks.push({ kind: "table", rows: grid });
  }

  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const y = lines[index]?.[0]?.y ?? 0;
    const previousY = lines[index - 1]?.[0]?.y ?? y;
    const height = lines[index]?.[0]?.height || 12;
    const gap = index > 0 ? previousY - y : 0;
    if (row.length >= 2) {
      if (text.length > 0) flushText();
      const previousRow = table[table.length - 1];
      const aligned =
        previousRow !== undefined &&
        row.filter((chunk) => previousRow.some((item) => Math.abs(item.x - chunk.x) <= 24)).length >= Math.min(2, row.length, previousRow.length);
      if (table.length > 0 && (gap > height * 6 || !aligned)) flushTable();
      table.push(row);
      return;
    }
    if (table.length > 0) flushTable();
    const line = row.map((chunk) => chunk.text).join(" ").trim();
    if (!line) return;
    if (text.length > 0 && previous && gap > height * 2.2) flushText();
    text.push(line);
  });
  flushTable();
  flushText();
  return blocks;
}

export async function readPdfBlocks(bytes: Uint8Array): Promise<Result<DocBlock[]>> {
  try {
    const pdfjs = await loadPdfjs();
    const document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false }).promise;
    const pages: PdfGlyph[][] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const glyphs: PdfGlyph[] = [];
      for (const item of content.items) {
        if (!isTextItem(item) || !item.str || !item.transform) continue;
        const x = item.transform[4] ?? 0;
        const y = item.transform[5] ?? 0;
        const height = item.height || Math.abs(item.transform[3] ?? 0) || 12;
        glyphs.push({ text: item.str, x, y, width: item.width ?? 0, height });
      }
      pages.push(glyphs);
    }
    const table = layoutPlanTable(pages);
    if (table) return { ok: true, data: [{ kind: "table", rows: table }] };
    return { ok: true, data: pages.flatMap((glyphs) => glyphsToBlocks(glyphs)) };
  } catch {
    return { ok: false, error: "PDF에서 글자를 읽지 못했습니다. 암호가 걸려 있거나, 글자 대신 그림만 있는 파일일 수 있습니다." };
  }
}
