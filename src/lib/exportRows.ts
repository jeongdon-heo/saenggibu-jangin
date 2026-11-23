import { countChars, countNeisBytes } from "./textCount";
import { findRecord, sortedStudents } from "./model";
import type { AppData, StudentRecord } from "../types";

export type ExportLayout = "rows" | "columns";
export type ExportKind = "교과 평어" | "관찰기록";

export function exportEntries(record: StudentRecord | undefined): Array<{ kind: ExportKind; text: string }> {
  if (!record) return [];
  const entries: Array<{ kind: ExportKind; text: string }> = [];
  if (record.draftConfirmed && record.draft.trim()) entries.push({ kind: "교과 평어", text: record.draft });
  if (record.observationConfirmed && record.observation.trim()) entries.push({ kind: "관찰기록", text: record.observation });
  return entries;
}

export function appendObservationToDraft(draft: string, observation: string): string {
  const extra = observation.trim();
  if (!extra || draft.includes(extra)) return draft;
  const base = draft.trim();
  return base ? `${base} ${extra}` : extra;
}

export type ExportRow = {
  number: number;
  alias: string;
  subject: string;
  kind: ExportKind;
  draft: string;
  chars: number;
  bytes: number;
};

export const EXPORT_HEADERS = ["번호", "이니셜", "과목", "구분", "성취수준 및 특기사항", "글자수", "바이트"] as const;

export function buildExportRows(data: AppData): ExportRow[] {
  const students = sortedStudents(data.students);
  const rows: ExportRow[] = [];
  for (const subject of data.subjects) {
    for (const student of students) {
      for (const entry of exportEntries(findRecord(data, student.id, subject.id))) {
        rows.push({
          number: student.number,
          alias: student.alias,
          subject: subject.name,
          kind: entry.kind,
          draft: entry.text,
          chars: countChars(entry.text),
          bytes: countNeisBytes(entry.text),
        });
      }
    }
  }
  return rows;
}

function columnLabel(row: ExportRow): string {
  return row.kind === "관찰기록" ? `${row.subject} 관찰기록` : row.subject;
}

export function buildExportTable(data: AppData, layout: ExportLayout): string[][] {
  const rows = buildExportRows(data);
  if (layout === "rows") {
    return [[...EXPORT_HEADERS], ...rows.map((row) => [String(row.number), row.alias, row.subject, row.kind, row.draft, String(row.chars), String(row.bytes)])];
  }
  const subjectOrder = data.subjects.flatMap((subject) => {
    const labels: string[] = [];
    if (rows.some((row) => row.subject === subject.name && row.kind === "교과 평어")) labels.push(subject.name);
    if (rows.some((row) => row.subject === subject.name && row.kind === "관찰기록")) labels.push(`${subject.name} 관찰기록`);
    return labels;
  });
  const byStudent = new Map<number, { alias: string; texts: Record<string, string> }>();
  for (const row of rows) {
    const current = byStudent.get(row.number) ?? { alias: row.alias, texts: {} };
    current.texts[columnLabel(row)] = row.draft;
    byStudent.set(row.number, current);
  }
  return [
    ["번호", "이니셜", ...subjectOrder],
    ...[...byStudent.keys()]
      .sort((a, b) => a - b)
      .map((number) => {
        const item = byStudent.get(number);
        return [String(number), item?.alias ?? "", ...subjectOrder.map((name) => item?.texts[name] ?? "")];
      }),
  ];
}
