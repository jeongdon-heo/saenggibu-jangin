import { findCodes } from "./parse";
import type { PdfGlyph } from "./pdfRead";
import { subjectFromCode } from "./subjectCode";

type Column = {
  label: string;
  role: "subject" | "unit" | "element" | "area" | "when" | "method" | "standards" | "level" | "other";
  x0: number;
  x1: number;
};

type LineInfo = {
  y: number;
  text: string;
  end: number;
  lastToken: string;
};

const HEADER_ROLE: Record<string, Column["role"]> = {
  과목: "subject",
  교과: "subject",
  단원: "unit",
  학습주제: "unit",
  평가요소: "element",
  요소: "element",
  영역: "area",
  시기: "when",
  평가방법: "method",
  방법: "method",
  성취기준: "standards",
  잘함: "level",
  보통: "level",
  노력요함: "level",
  상: "level",
  중: "level",
  하: "level",
};

const PARTICLE = /^(을|를|이|가|은|는|과|와|에서|에게|부터|까지|에|로)( |$)/;

function isHangulFragment(token: string): boolean {
  return /^[가-힣](?:[을를이가은는과와에로의])?$/.test(token);
}

function polishSpacing(text: string): string {
  return text
    .replace(/수있/g, "수 있")
    .replace(/수없/g, "수 없")
    .replace(/할수(?= )/g, "할 수")
    .replace(/된후/g, "된 후")
    .replace(/([가-힣]) (적으로|적인|하여|르게|으며)/g, "$1$2")
    .replace(/([가-힣]) 의 (?=[가-힣])/g, "$1의 ")
    .replace(/([가-힣]) 성(?=[을를이가은는])/g, "$1성")
    .replace(/([가-힣]) 며(?=[\s가-힣.,]|$)/g, "$1며")
    .replace(/ ([을를이가은는]) (?=[가-힣])/g, "$1")
    .replace(/ ([다])(?=[.]|$)/g, "$1")
    .replace(/ +/g, " ")
    .trim();
}

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

function headerRole(text: string): Column["role"] | null {
  const key = compact(text);
  if (!key || key === "평가기준") return null;
  return HEADER_ROLE[key] ?? null;
}

function inkWidth(glyph: PdfGlyph): number {
  const text = glyph.text.trim();
  if (!text) return 0;
  if (glyph.width > 0 && glyph.width < 70) return glyph.width;
  return Math.max(6, text.length * (glyph.height || 8) * 0.85);
}

function groupLines(glyphs: PdfGlyph[]): PdfGlyph[][] {
  const sorted = [...glyphs].sort((left, right) => right.y - left.y || left.x - right.x);
  const lines: PdfGlyph[][] = [];
  for (const glyph of sorted) {
    const line = lines[lines.length - 1];
    const anchor = line?.[0];
    if (line && anchor && Math.abs(anchor.y - glyph.y) <= 2.4) line.push(glyph);
    else lines.push([glyph]);
  }
  return lines;
}

function collapseLetterSpacing(text: string): string {
  const parts = text.split(" ");
  if (parts.length < 4) return text;
  const singles = parts.filter((part) => /^[가-힣]$/.test(part)).length;
  if (singles >= 4 && singles / parts.length >= 0.75) return parts.join("");
  return text;
}

function lineInfo(glyphs: PdfGlyph[]): LineInfo | null {
  const items = glyphs.filter((glyph) => glyph.text.trim()).sort((left, right) => left.x - right.x);
  if (items.length === 0) return null;
  let text = "";
  let end = 0;
  let lastToken = "";
  const size = Math.max(8, ...items.map((item) => item.height || 0));
  for (const item of items) {
    const token = collapseLetterSpacing(item.text.trim());
    const gap = text ? item.x - end : 0;
    if (text && gap > size * 0.45 && !text.endsWith(" ")) text += " ";
    text += token;
    end = item.x + inkWidth({ ...item, text: token });
    lastToken = token;
  }
  const y = items.reduce((sum, item) => sum + item.y, 0) / items.length;
  return { y, text: text.replace(/ +/g, " ").trim(), end, lastToken };
}

export function sentenceEnded(text: string): boolean {
  const folded = text.replace(/\s+/g, "");
  return /(?:다|요|까|죠|니까)\.?$/.test(folded);
}

function glueLines(lines: LineInfo[], right: number): string {
  let out = "";
  let previous: LineInfo | null = null;
  for (const line of lines) {
    if (!line.text) continue;
    if (!out || !previous) {
      out = line.text;
      previous = line;
      continue;
    }
    const size = 8;
    const full = right - previous.end < size * 1.2;
    const nextFirst = line.text.split(/\s+/)[0] ?? "";
    const particle = PARTICLE.test(line.text);
    const nextFragment = isHangulFragment(nextFirst);
    const cutTail = /^[가-힣]$/.test(previous.lastToken) || /[·ㆍ\-–—][가-힣]$/.test(previous.lastToken) || / [가-힣]$/.test(previous.text);
    const ended = /[.?!。]$/.test(previous.text) || sentenceEnded(previous.text);
    const auxiliary = previous.lastToken === "수" && /^[있없]/.test(nextFirst);
    const boundTail = /^(?:하기|하고|하며|하여|하는|하면|해서|성)(?:[\s,]|$|[을를이가은는에의])/.test(line.text) || (previous.lastToken === "필요" && nextFirst === "한");
    let space = true;
    if (auxiliary || (ended && !boundTail)) space = true;
    else if (particle || boundTail || (full && (nextFragment || cutTail))) space = false;
    out += `${space ? " " : ""}${line.text}`;
    previous = line;
  }
  return polishSpacing(out);
}

function columnLines(glyphs: PdfGlyph[], column: Column): LineInfo[] {
  const inside = glyphs.filter((glyph) => glyph.text.trim() && glyph.x >= column.x0 && glyph.x < column.x1);
  return groupLines(inside)
    .map((line) => lineInfo(line))
    .filter((line): line is LineInfo => line !== null && line.text.length > 0);
}

function findHeader(glyphs: PdfGlyph[]): { columns: Column[]; bodyTop: number } | null {
  const lines = groupLines(glyphs.filter((glyph) => glyph.text.trim()));
  let headerIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const roles = (lines[index] ?? []).map((glyph) => headerRole(glyph.text)).filter((role) => role && role !== "level");
    if (new Set(roles).size >= 3) {
      headerIndex = index;
      break;
    }
  }
  if (headerIndex < 0) return null;
  const anchors: Array<{ x: number; label: string; role: Column["role"]; y: number }> = [];
  const headerLines = [lines[headerIndex], lines[headerIndex + 1]].filter((line): line is PdfGlyph[] => line !== undefined);
  const headerBottom = Math.min(...headerLines.flat().map((glyph) => glyph.y));
  for (const line of headerLines) {
    const info = lineInfo(line);
    if (!info) continue;
    if (Math.abs(info.y - (lineInfo(lines[headerIndex] ?? [])?.y ?? info.y)) > 14) continue;
    for (const glyph of line) {
      const role = headerRole(glyph.text);
      if (!role) continue;
      anchors.push({ x: glyph.x, label: compact(glyph.text), role, y: glyph.y });
    }
  }
  const levels = anchors.filter((anchor) => anchor.role === "level");
  const kept = anchors.filter((anchor) => anchor.role !== "level" || levels.length >= 2);
  kept.sort((left, right) => left.x - right.x);
  const unique: typeof kept = [];
  for (const anchor of kept) {
    const previous = unique[unique.length - 1];
    if (previous && anchor.x - previous.x < 12 && previous.role === anchor.role) continue;
    unique.push(anchor);
  }
  if (!unique.some((anchor) => anchor.role === "standards") || !unique.some((anchor) => anchor.role === "element" || anchor.role === "level")) {
    return null;
  }
  const bodyXs = glyphs
    .filter((glyph) => glyph.text.trim() && glyph.y < headerBottom - 4)
    .map((glyph) => glyph.x)
    .sort((left, right) => left - right);
  const bounds: number[] = [];
  for (let index = 0; index < unique.length - 1; index += 1) {
    const left = unique[index]?.x ?? 0;
    const right = unique[index + 1]?.x ?? left + 40;
    const starts = bodyXs.filter((x) => x >= left + 2 && x <= right + 2);
    let bestGap = 0;
    let bestAt = (left + right) / 2;
    for (let cursor = 1; cursor < starts.length; cursor += 1) {
      const gap = (starts[cursor] ?? 0) - (starts[cursor - 1] ?? 0);
      if (gap > bestGap) {
        bestGap = gap;
        bestAt = ((starts[cursor] ?? 0) + (starts[cursor - 1] ?? 0)) / 2;
      }
    }
    bounds.push(bestGap >= 10 ? bestAt : (left + right) / 2);
  }
  const columns: Column[] = unique.map((anchor, index) => ({
    label: anchor.label,
    role: anchor.role,
    x0: index === 0 ? anchor.x - 16 : (bounds[index - 1] ?? anchor.x - 8),
    x1: bounds[index] ?? anchor.x + 72,
  }));
  return { columns, bodyTop: headerBottom - 4 };
}

function clustersOf(glyphs: PdfGlyph[], gap: number): Array<{ y: number; glyphs: PdfGlyph[] }> {
  const sorted = [...glyphs].sort((left, right) => right.y - left.y);
  const groups: Array<{ top: number; bottom: number; glyphs: PdfGlyph[] }> = [];
  for (const glyph of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.bottom - glyph.y < gap) {
      last.glyphs.push(glyph);
      last.bottom = Math.min(last.bottom, glyph.y);
    } else {
      groups.push({ top: glyph.y, bottom: glyph.y, glyphs: [glyph] });
    }
  }
  return groups.map((group) => ({ y: (group.top + group.bottom) / 2, glyphs: group.glyphs }));
}

function tightenArea(value: string): string {
  return value
    .replace(/(^|\s)([가-힣])\s+(?=[가-힣](?:\s|·|$))/g, "$1$2")
    .replace(/\s*·\s*/g, "·")
    .replace(/ +/g, " ")
    .trim();
}

function isNoise(text: string): boolean {
  const folded = text.replace(/\s+/g, "");
  if (!folded) return true;
  if (folded.includes("▣") || folded.includes("문항수")) return true;
  if (folded.includes("평가단계")) return true;
  if (/^<\d학기>/.test(folded)) return true;
  if (folded === "수행평가" || folded === "수행평가계획") return true;
  return false;
}

function elementClosed(text: string): boolean {
  const folded = text.replace(/\s+/g, "");
  return /(?:기|다|요|음|까)$/.test(folded);
}

type LaidPage = {
  rows: string[][];
  overflow: string[];
  centers: number[];
};


function appendText(previous: string, extra: string): string {
  if (!extra) return previous;
  if (!previous) return extra;
  const trimmed = extra.trim();
  const nextFirst = trimmed.split(/\s+/)[0] ?? "";
  const lastToken = previous.trim().split(/\s+/).at(-1) ?? "";
  if (sentenceEnded(previous) || (lastToken === "수" && /^[있없]/.test(trimmed))) return polishSpacing(`${previous} ${trimmed}`);
  if (/^(?:하기|하고|하며|하여|하는|하면|해서|성)(?:[\s,]|$|[을를이가은는에의])/.test(trimmed) || (lastToken === "필요" && trimmed.startsWith("한"))) return polishSpacing(`${previous}${trimmed}`);
  if (PARTICLE.test(trimmed) || isHangulFragment(nextFirst) || / [가-힣]$/.test(previous.trim())) return polishSpacing(`${previous}${trimmed}`);
  return polishSpacing(`${previous} ${trimmed}`);
}

function layoutPage(glyphs: PdfGlyph[], columns: Column[], bodyTop: number): LaidPage {
  const body = glyphs.filter((glyph) => glyph.text.trim() && !isNoise(glyph.text) && glyph.y < bodyTop && glyph.y > 28);
  const elementColumn = columns.find((column) => column.role === "element");
  const elementGlyphs = elementColumn ? body.filter((glyph) => glyph.x >= elementColumn.x0 && glyph.x < elementColumn.x1) : [];
  const clusters = clustersOf(elementGlyphs, 16);
  const blocks = clusters
    .map((cluster) => ({
      top: Math.max(...cluster.glyphs.map((glyph) => glyph.y)),
      bottom: Math.min(...cluster.glyphs.map((glyph) => glyph.y)),
    }))
    .sort((left, right) => right.top - left.top);
  const starts = blocks.map((block) => block.top);
  if (starts.length === 0) return { rows: [], overflow: columns.map(() => ""), centers: [] };
  const columnLineCache = columns.map((column) => columnLines(body, column));
  for (let index = 0; index < starts.length; index += 1) {
    let raised = starts[index] ?? 0;
    const ceiling = index === 0 ? Number.POSITIVE_INFINITY : (blocks[index - 1]?.bottom ?? raised) - 3;
    let grew = true;
    while (grew) {
      grew = false;
      for (const lines of columnLineCache) {
        for (const line of lines) {
          if (line.y > raised && line.y < ceiling && line.y - raised <= 13 && !sentenceEnded(line.text)) {
            raised = line.y;
            grew = true;
          }
        }
      }
    }
    starts[index] = raised;
  }
  const rowCount = starts.length;
  const buckets: LineInfo[][][] = columns.map(() => Array.from({ length: rowCount }, () => []));
  const overflowLines: LineInfo[][] = columns.map(() => []);
  const rowStarts = starts;
  function rowIndex(y: number): number | null {
    const first = rowStarts[0] ?? 0;
    if (y > first + 2) return null;
    for (let index = 0; index < rowStarts.length; index += 1) {
      const top = rowStarts[index] ?? 0;
      const bottom = rowStarts[index + 1] ?? Number.NEGATIVE_INFINITY;
      if (y <= top + 2 && y > bottom + 2) return index;
    }
    return rowStarts.length - 1;
  }
  columns.forEach((column, columnIndex) => {
    for (const line of columnLines(body, column)) {
      const row = rowIndex(line.y);
      if (row === null) overflowLines[columnIndex]?.push(line);
      else buckets[columnIndex]?.[row]?.push(line);
    }
  });
  const rows = Array.from({ length: rowCount }, (_, row) =>
    columns.map((column, columnIndex) => {
      const text = glueLines(buckets[columnIndex]?.[row] ?? [], column.x1);
      return column.role === "area" ? tightenArea(text) : text;
    }),
  );
  const overflow = columns.map((column, columnIndex) => glueLines(overflowLines[columnIndex] ?? [], column.x1));
  const centers = blocks.map((block) => (block.top + block.bottom) / 2);
  return { rows, overflow, centers };
}

const UNIT_HEAD = /^(?:\d+(?:-\d+)?\.|[<＜“"]|[A-Za-z])/;

function place(pageIndex: number, y: number): number {
  return pageIndex * 900 + (900 - y);
}

function unitAnchors(pages: PdfGlyph[][], columns: Column[]): Array<{ pos: number; text: string }> {
  const column = columns.find((item) => item.role === "unit");
  if (!column) return [];
  const blocks: Array<{ pos: number; text: string }> = [];
  pages.forEach((page, pageIndex) => {
    const lines = columnLines(
      page.filter((glyph) => glyph.text.trim() && !isNoise(glyph.text) && glyph.y < 790 && glyph.y > 28),
      column,
    );
    let group: LineInfo[] = [];
    const flush = () => {
      if (group.length === 0) return;
      const text = glueLines(group, column.x1);
      const y = group.reduce((sum, line) => sum + line.y, 0) / group.length;
      if (text && !/^(단원|학습주제)$/.test(text)) blocks.push({ pos: place(pageIndex, y), text });
      group = [];
    };
    for (const line of lines) {
      const previous = group[group.length - 1];
      if (previous && previous.y - line.y > 14) flush();
      group.push(line);
    }
    flush();
  });
  const joined: Array<{ pos: number; text: string }> = [];
  for (const block of blocks) {
    const previous = joined[joined.length - 1];
    if (previous && !UNIT_HEAD.test(block.text)) {
      if (/(?:와|과|,|·)$/.test(previous.text)) {
        previous.text = polishSpacing(`${previous.text} ${block.text}`);
        previous.pos = (previous.pos + block.pos) / 2;
      }
    } else joined.push({ ...block });
  }
  return joined;
}

function assignUnitAnchors(rows: string[][], positions: number[], anchors: Array<{ pos: number; text: string }>): void {
  if (anchors.length === 0) return;
  const anchorSubject = anchors.map((anchor) => {
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    positions.forEach((pos, index) => {
      const distance = Math.abs(pos - anchor.pos);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return rows[best + 1]?.[0] ?? "";
  });
  positions.forEach((pos, index) => {
    const row = rows[index + 1];
    if (!row) return;
    const subject = row[0] ?? "";
    const usable = anchors
      .map((anchor, anchorIndex) => ({ anchor, anchorIndex }))
      .filter((item) => !subject || anchorSubject[item.anchorIndex] === subject);
    const pool = usable.length > 0 ? usable : anchors.map((anchor, anchorIndex) => ({ anchor, anchorIndex }));
    let chosen = pool[0];
    for (let cursor = 0; cursor < pool.length; cursor += 1) {
      const current = pool[cursor];
      const next = pool[cursor + 1];
      const bound = next ? current.anchor.pos + (next.anchor.pos - current.anchor.pos) * 0.62 : Number.POSITIVE_INFINITY
      if (pos < bound) {
        chosen = current;
        break;
      }
      chosen = current;
    }
    if (chosen?.anchor.text) row[1] = chosen.anchor.text;
  });
}

const OUTPUT = ["과목", "단원", "평가요소", "영역", "시기", "평가방법", "성취기준", "상", "중", "하"] as const;

function outputIndex(role: Column["role"], label: string): number {
  if (role === "subject") return 0;
  if (role === "unit") return 1;
  if (role === "element") return 2;
  if (role === "area") return 3;
  if (role === "when") return 4;
  if (role === "method") return 5;
  if (role === "standards") return 6;
  if (role === "level" && (label === "상" || label === "잘함")) return 7;
  if (role === "level" && (label === "중" || label === "보통")) return 8;
  if (role === "level" && (label === "하" || label === "노력요함")) return 9;
  return -1;
}

export function readExpectedCounts(pages: PdfGlyph[][]): Record<string, number> {
  const footer = pages.flat().map((glyph) => glyph.text).find((text) => text.includes("문항수") || text.includes("▣"));
  if (!footer) return {};
  const counts: Record<string, number> = {};
  for (const match of footer.matchAll(/([가-힣]{1,8})\((\d+)\)/g)) {
    const name = match[1];
    const count = Number(match[2]);
    if (name && Number.isInteger(count)) counts[name] = count;
  }
  return counts;
}

function reclaimLevelTails(rows: string[][]): void {
  for (let index = 2; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (!previous || !current) continue;
    for (const slot of [7, 8, 9]) {
      const before = previous[slot] ?? "";
      const after = current[slot] ?? "";
      if (!before || !after || sentenceEnded(before)) continue;
      const match = after.match(/^(.+?(?:다|요|까)\.)\s+(\S[\s\S]+)$/);
      const head = match?.[1] ?? "";
      const rest = match?.[2] ?? "";
      if (!head || !rest || head.length > 90) continue;
      previous[slot] = polishSpacing(`${before} ${head}`);
      current[slot] = rest;
    }
  }
}

export function layoutPlanTable(pages: PdfGlyph[][]): string[][] | null {
  const flat = pages.map((page) => page.filter((glyph) => !isNoise(glyph.text))).flat();
  const header = findHeader(flat);
  if (!header) return null;
  const rows: string[][] = [OUTPUT.slice()];
  const positions: number[] = [];
  let previousSubject = "";
  let previousUnit = "";
  pages.forEach((page, pageIndex) => {
    const laid = layoutPage(page, header.columns, pageIndex === 0 ? header.bodyTop : 820);
    const pagePositions: number[] = [];
    const overflow = OUTPUT.map(() => "");
    header.columns.forEach((column, index) => {
      const slot = outputIndex(column.role, column.label);
      if (slot >= 0) overflow[slot] = laid.overflow[index] ?? "";
    });
    const last = rows[rows.length - 1];
    if (last && rows.length > 1 && overflow.some((cell) => cell.trim())) {
      overflow.forEach((extra, index) => {
        last[index] = appendText(last[index] ?? "", extra);
      });
    }
    const pageRows: string[][] = [];
    laid.rows.forEach((row, rowIndex) => {
      const output = OUTPUT.map(() => "");
      header.columns.forEach((column, index) => {
        const slot = outputIndex(column.role, column.label);
        if (slot >= 0) output[slot] = row[index] ?? "";
      });
      if (!output[0]) {
        const coded = findCodes(output[6] ?? "").map((code) => subjectFromCode(code)).find((name): name is string => Boolean(name));
        if (coded) output[0] = coded;
      }
      if (output.some((cell) => cell.trim())) {
        pageRows.push(output);
        pagePositions.push(place(pageIndex, laid.centers[rowIndex] ?? 400));
      }
    });
    if (pageRows.length > 0 && rows.length > 1) {
      const previous = rows[rows.length - 1];
      const first = pageRows[0];
      const continued = previous && first && !elementClosed(previous[2] ?? "");
      if (continued && first) {
        first.forEach((cell, index) => {
          previous[index] = appendText(previous[index] ?? "", cell);
        });
        pageRows.shift();
        const extra = pagePositions.shift();
        const start = positions[positions.length - 1];
        if (start !== undefined && extra !== undefined) positions[positions.length - 1] = (start + extra) / 2;
      }
    }
    pageRows.forEach((output, index) => {
      if (!output[0]) output[0] = previousSubject;
      if (output[0] !== previousSubject) previousUnit = "";
      previousSubject = output[0] ?? "";
      if (!output[1]) output[1] = previousUnit;
      else previousUnit = output[1];
      rows.push(output);
      positions.push(pagePositions[index] ?? place(pageIndex, 400));
    });
  });
  assignUnitAnchors(rows, positions, unitAnchors(pages, header.columns));
  reclaimLevelTails(rows);
  return rows.length > 1 ? rows : null;
}
