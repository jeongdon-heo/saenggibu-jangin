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

function lineInfo(glyphs: PdfGlyph[]): LineInfo | null {
  const items = glyphs.filter((glyph) => glyph.text.trim()).sort((left, right) => left.x - right.x);
  if (items.length === 0) return null;
  let text = "";
  let end = 0;
  let lastToken = "";
  for (const item of items) {
    const token = item.text.trim();
    const gap = text ? item.x - end : 0;
    if (text && gap > 1.6 && !text.endsWith(" ")) text += " ";
    text += token;
    end = item.x + inkWidth(item);
    lastToken = token;
  }
  const y = items.reduce((sum, item) => sum + item.y, 0) / items.length;
  return { y, text: text.replace(/ +/g, " ").trim(), end, lastToken };
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
    const full = right - previous.end < 18;
    const cut =
      /^[가-힣]$/.test(previous.lastToken) ||
      /[·ㆍ\-–—][가-힣]$/.test(previous.lastToken) ||
      / [가-힣]$/.test(previous.text);
    const particle = PARTICLE.test(line.text);
    const ended = /[.?!]$/.test(previous.text);
    const space = ended || !(cut || (full && particle));
    out += `${space ? " " : ""}${line.text}`;
    previous = line;
  }
  return out.replace(/ +/g, " ").trim();
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

function nearestIndex(y: number, anchors: number[]): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  anchors.forEach((anchor, index) => {
    const gap = Math.abs(anchor - y);
    if (gap < distance) {
      distance = gap;
      best = index;
    }
  });
  return best;
}

function tightenArea(value: string): string {
  return value
    .replace(/(^|\s)([가-힣])\s+(?=[가-힣](?:\s|·|$))/g, "$1$2")
    .replace(/\s*·\s*/g, "·")
    .replace(/ +/g, " ")
    .trim();
}

type PageRows = {
  rows: string[][];
  leading: string;
  trailing: string;
};

function layoutPage(glyphs: PdfGlyph[], columns: Column[], bodyTop: number): PageRows {
  const body = glyphs.filter((glyph) => glyph.text.trim() && glyph.y < bodyTop && glyph.y > 28);
  const area = columns.find((column) => column.role === "area") ?? columns.find((column) => column.role === "method");
  const anchorGlyphs = area ? body.filter((glyph) => glyph.x >= area.x0 && glyph.x < area.x1) : [];
  const anchors = clustersOf(anchorGlyphs, 22).map((cluster) => cluster.y);
  if (anchors.length === 0) return { rows: [], leading: "", trailing: "" };
  const standards = columns.find((column) => column.role === "standards");
  const standardLines = standards ? columnLines(body, standards) : [];
  const chunks: LineInfo[][] = [];
  const leadingLines: LineInfo[] = [];
  let current: LineInfo[] = [];
  let sawCode = false;
  for (const line of standardLines) {
    const coded = findCodes(line.text).length > 0;
    if (!sawCode && !coded) {
      leadingLines.push(line);
      continue;
    }
    if (coded && current.length > 0) chunks.push(current);
    sawCode = true;
    if (coded) current = [line];
    else current.push(line);
  }
  if (current.length > 0) chunks.push(current);
  const statements = chunks.map((chunk) => ({
    y: chunk[0]?.y ?? 0,
    text: standards ? glueLines(chunk, standards.x1) : "",
  }));
  const rowCount = anchors.length;
  const cells: string[][] = Array.from({ length: rowCount }, () => columns.map(() => ""));
  const standardIndex = columns.findIndex((column) => column.role === "standards");
  statements.forEach((statement) => {
    const row = nearestIndex(statement.y, anchors);
    const target = cells[row];
    if (!target || standardIndex < 0) return;
    target[standardIndex] = [target[standardIndex], statement.text].filter(Boolean).join(" ");
  });
  columns.forEach((column, index) => {
    if (column.role === "standards" || column.role === "subject" || column.role === "unit") return;
    const lines = columnLines(body, column);
    const buckets: LineInfo[][] = Array.from({ length: rowCount }, () => []);
    for (const line of lines) buckets[nearestIndex(line.y, anchors)]?.push(line);
    buckets.forEach((bucket, row) => {
      const target = cells[row];
      if (target) {
        const text = glueLines(bucket, column.x1);
        target[index] = column.role === "area" ? tightenArea(text) : text;
      }
    });
  });
  const subjectIndex = columns.findIndex((column) => column.role === "subject");
  const subjects = cells.map((row) => {
    const coded = findCodes(row[standardIndex] ?? "")
      .map((code) => subjectFromCode(code))
      .find((name): name is string => Boolean(name));
    return coded ?? "";
  });
  let carriedSubject = "";
  subjects.forEach((name, index) => {
    if (name) carriedSubject = name;
    else if (carriedSubject) subjects[index] = carriedSubject;
  });
  const firstNamed = subjects.findIndex((name) => name);
  if (firstNamed > 0) {
    const name = subjects[firstNamed] ?? "";
    for (let index = 0; index < firstNamed; index += 1) {
      if (!subjects[index]) subjects[index] = name;
    }
  }
  if (subjectIndex >= 0) {
    subjects.forEach((name, index) => {
      const row = cells[index];
      if (row) row[subjectIndex] = name;
    });
  }
  const unitColumn = columns.find((column) => column.role === "unit");
  const unitIndex = columns.findIndex((column) => column.role === "unit");
  const unitClusters = unitColumn
    ? clustersOf(
        body.filter((glyph) => glyph.x >= unitColumn.x0 && glyph.x < unitColumn.x1),
        28,
      )
    : [];
  const unitMarks = unitClusters.map((cluster) => ({
    y: cluster.y,
    text: glueLines(
      columnLines(cluster.glyphs, { label: "단원", role: "unit", x0: Number.NEGATIVE_INFINITY, x1: Number.POSITIVE_INFINITY }),
      unitColumn?.x1 ?? 0,
    ),
  }));
  if (unitIndex >= 0 && unitMarks.length > 0) {
    const ordered = [...unitMarks].sort((left, right) => right.y - left.y);
    const first = ordered[0];
    const topAnchor = anchors[0] ?? first?.y ?? 0;
    const startsNearTop = first !== undefined && topAnchor - first.y < 140;
    cells.forEach((row, index) => {
      const y = anchors[index] ?? 0;
      if (!startsNearTop && first && y > first.y) return;
      let chosen = first;
      for (let markIndex = 0; markIndex < ordered.length; markIndex += 1) {
        const mark = ordered[markIndex];
        const previous = ordered[markIndex - 1];
        const next = ordered[markIndex + 1];
        if (!mark) continue;
        const top = previous ? (previous.y + mark.y) / 2 : Number.POSITIVE_INFINITY;
        const bottom = next ? (mark.y + next.y) / 2 : Number.NEGATIVE_INFINITY;
        if (y <= top && y > bottom) chosen = mark;
      }
      if (chosen?.text) row[unitIndex] = chosen.text;
    });
  }
  return {
    rows: cells,
    leading: glueLines(leadingLines, standards?.x1 ?? 0),
    trailing: "",
  };
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
  if (role === "level" && label === "상") return 7;
  if (role === "level" && label === "중") return 8;
  if (role === "level" && label === "하") return 9;
  if (role === "level" && label === "잘함") return 7;
  if (role === "level" && label === "보통") return 8;
  if (role === "level" && label === "노력요함") return 9;
  return -1;
}

export function layoutPlanTable(pages: PdfGlyph[][]): string[][] | null {
  const flat = pages.flat();
  const header = findHeader(flat);
  if (!header) return null;
  const headerLine = OUTPUT.slice();
  const rows: string[][] = [headerLine];
  let previousSubject = "";
  let previousUnit = "";
  for (const page of pages) {
    const laid = layoutPage(page, header.columns, pages[0] === page ? header.bodyTop : 820);
    if (laid.leading) {
      const last = rows[rows.length - 1];
      if (last && rows.length > 1) last[6] = [last[6], laid.leading].filter(Boolean).join(" ");
    }
    for (const row of laid.rows) {
      const output = OUTPUT.map(() => "");
      header.columns.forEach((column, index) => {
        const slot = outputIndex(column.role, column.label);
        if (slot >= 0) output[slot] = row[index] ?? "";
      });
      if (!output[0]) output[0] = previousSubject;
      if (output[0] !== previousSubject) previousUnit = "";
      previousSubject = output[0] ?? "";
      if (!output[1]) output[1] = previousUnit;
      else previousUnit = output[1];
      if (output.some((cell) => cell.trim())) rows.push(output);
    }
  }
  return rows.length > 1 ? rows : null;
}

