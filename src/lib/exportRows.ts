import { countChars, countNeisBytes } from "./textCount";
import { findRecord, sortedStudents } from "./model";
import type { AppData } from "../types";

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
      const draft = findRecord(data, student.id, subject.id)?.draft ?? "";
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
