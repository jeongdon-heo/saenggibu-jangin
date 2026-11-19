import { countChars, countNeisBytes } from "./textCount";
import { findRecord, sortedStudents } from "./model";
import type { AppData, StudentRecord } from "../types";

export type ExportLayout = "rows" | "columns";

export function confirmedText(record: StudentRecord | undefined): string {
  if (!record) return "";
  if (record.observationConfirmed && record.observation.trim()) return record.observation;
  if (record.draftConfirmed && record.draft.trim()) return record.draft;
  return "";
}

export type ExportRow = {
  number: number;
  alias: string;
  subject: string;
  draft: string;
  chars: number;
  bytes: number;
};

export const EXPORT_HEADERS = ["번호", "이니셜", "과목", "성취수준 및 특기사항", "글자수", "바이트"] as const;

export function buildExportRows(data: AppData): ExportRow[] {
  const students = sortedStudents(data.students);
  const rows: ExportRow[] = [];
  for (const subject of data.subjects) {
    for (const student of students) {
      const draft = confirmedText(findRecord(data, student.id, subject.id));
      if (!draft) continue;
      rows.push({
        number: student.number,
        alias: student.alias,
        subject: subject.name,
        draft,
        chars: countChars(draft),
        bytes: countNeisBytes(draft),
      });
    }
  }
  return rows;
}

export function buildExportTable(data: AppData, layout: ExportLayout): string[][] {
  const rows = buildExportRows(data);
  if (layout === "rows") {
    return [[...EXPORT_HEADERS], ...rows.map((row) => [String(row.number), row.alias, row.subject, row.draft, String(row.chars), String(row.bytes)])];
  }
  const subjectOrder = data.subjects.map((subject) => subject.name).filter((name) => rows.some((row) => row.subject === name));
  const byStudent = new Map<number, { alias: string; texts: Record<string, string> }>();
  for (const row of rows) {
    const current = byStudent.get(row.number) ?? { alias: row.alias, texts: {} };
    current.texts[row.subject] = row.draft;
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
