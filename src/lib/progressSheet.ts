import type { Result } from "../types";

export type ParsedUnit = {
  order: number;
  grade: number | null;
  semester: number | null;
  organization: string;
  title: string;
  content: string;
  pages: string;
  extraPages: string;
  period: string;
  totalPeriods: string;
  materials: string;
};

const HEADER_FIELDS = [
  ["보조쪽수", "extraPages"],
  ["전체차시", "totalPeriods"],
  ["해당차시", "period"],
  ["학습내용", "content"],
  ["준비물", "materials"],
  ["순번", "order"],
  ["학년", "grade"],
  ["학기", "semester"],
  ["편제", "organization"],
  ["단원", "title"],
  ["쪽수", "pages"],
] as const;

type Field = (typeof HEADER_FIELDS)[number][1];

function normHeader(value: string): string {
  return value.replace(/[*＊※\s]/g, "");
}

function matchField(header: string): Field | null {
  const norm = normHeader(header);
  for (const [key, field] of HEADER_FIELDS) {
    if (norm === key || norm.startsWith(key)) return field;
  }
  return null;
}

function headerMap(row: string[]): Partial<Record<Field, number>> | null {
  const map: Partial<Record<Field, number>> = {};
  row.forEach((cell, index) => {
    const field = matchField(cell);
    if (field && map[field] === undefined) map[field] = index;
  });
  return map.title === undefined ? null : map;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

function intOrNull(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export function parseProgressTable(rows: string[][]): Result<ParsedUnit[]> {
  let headerAt = -1;
  let map: Partial<Record<Field, number>> | null = null;
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const found = headerMap(rows[index] ?? []);
    if (found) {
      headerAt = index;
      map = found;
      break;
    }
  }
  if (!map) {
    return {
      ok: false,
      error: "진도표에서 단원 열을 찾지 못했습니다. 순번, 학년, 학기, 편제, 단원 열이 있는 나이스 진도표인지 확인해 주세요.",
    };
  }
  const units: ParsedUnit[] = [];
  for (const row of rows.slice(headerAt + 1)) {
    const title = cell(row, map.title);
    if (!title) continue;
    const orderText = cell(row, map.order);
    units.push({
      order: intOrNull(orderText) ?? units.length + 1,
      grade: intOrNull(cell(row, map.grade)),
      semester: intOrNull(cell(row, map.semester)),
      organization: cell(row, map.organization),
      title,
      content: cell(row, map.content),
      pages: cell(row, map.pages),
      extraPages: cell(row, map.extraPages),
      period: cell(row, map.period),
      totalPeriods: cell(row, map.totalPeriods),
      materials: cell(row, map.materials),
    });
  }
  if (units.length === 0) return { ok: false, error: "단원 행이 없습니다." };
  return { ok: true, data: units };
}
