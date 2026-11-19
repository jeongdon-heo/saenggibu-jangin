import type { AppData, Result } from "../types";
import type { ParsedComment } from "./commentParse";
import { anonymizeStudents } from "./commentPrompt";
import { upsertRecord } from "./model";

export function applyGeneratedText(
  data: AppData,
  subjectId: string,
  items: ParsedComment[],
  field: "draft" | "observation",
): Result<AppData> & { applied: number; unknown: string[] } {
  const links = new Map(anonymizeStudents(data.students).map((link) => [link.token, link.studentId]));
  let next = data;
  let applied = 0;
  const unknown: string[] = [];
  for (const item of items) {
    const studentId = links.get(item.token);
    if (!studentId) {
      unknown.push(item.token);
      continue;
    }
    next = upsertRecord(
      next,
      studentId,
      subjectId,
      field === "draft" ? { draft: item.text, draftConfirmed: false } : { observation: item.text, observationConfirmed: false },
    ).data;
    applied += 1;
  }
  if (applied === 0) return { ok: false, error: "자리표시와 맞는 학생을 찾지 못했습니다.", applied, unknown };
  return { ok: true, data: next, applied, unknown };
}
