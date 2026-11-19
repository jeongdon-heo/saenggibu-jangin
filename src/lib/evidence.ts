import type { AppData, EvidenceKind } from "../types";
import { findRecord } from "./model";
import { EVIDENCE_LABEL } from "./teacherAssess";

export type SentenceMark = {
  text: string;
  kinds: Array<EvidenceKind | "survey">;
  needsObservation: boolean;
};

export function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const PARTICLE = /(에서|부터|까지|으로|은|는|이|가|을|를|과|와|에|의|로|도|만)$/u;

function tokens(text: string): string[] {
  return text
    .replace(/\(예시\)/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.replace(PARTICLE, ""))
    .filter((word) => word.length >= 2);
}

function overlaps(sentence: string, note: string): boolean {
  const noteTokens = [...new Set(tokens(note))];
  const sentenceTokens = new Set(tokens(sentence));
  const shared = noteTokens.filter((word) => sentenceTokens.has(word));
  return shared.some((word) => word.length >= 4) || shared.length >= 2;
}

export function markSentences(draft: string, sources: Array<{ kind: EvidenceKind | "survey"; text: string }>): SentenceMark[] {
  return splitSentences(draft).map((text) => {
    const kinds = new Set<SentenceMark["kinds"][number]>();
    for (const source of sources) {
      if (source.text && overlaps(text, source.text)) kinds.add(source.kind);
    }
    const list = [...kinds];
    return {
      text,
      kinds: list,
      needsObservation: list.some((kind) => kind === "observe" || kind === "paper"),
    };
  });
}

export function evidenceSources(data: AppData, studentId: string, subjectId: string): Array<{ kind: EvidenceKind | "survey"; text: string }> {
  const subject = data.subjects.find((item) => item.id === subjectId);
  const sources: Array<{ kind: EvidenceKind | "survey"; text: string }> = [];
  const notes = findRecord(data, studentId, subjectId)?.notes.trim() ?? "";
  if (notes) sources.push({ kind: "observe", text: notes });
  if (!subject) return sources;
  for (const check of data.teacherChecks) {
    if (check.studentId !== studentId || check.subjectId !== subjectId || !check.note.trim()) continue;
    const unit = subject.units.find((item) => item.id === check.unitId);
    if (!unit || unit.skipped) continue;
    const kinds = check.evidences.length > 0 ? check.evidences : (["observe"] as EvidenceKind[]);
    for (const kind of kinds) sources.push({ kind, text: check.note });
  }
  return sources;
}

export function markDraft(data: AppData, studentId: string, subjectId: string, draft: string): SentenceMark[] {
  return markSentences(draft, evidenceSources(data, studentId, subjectId));
}

export function observationSeed(marks: SentenceMark[]): string {
  return marks
    .filter((mark) => mark.needsObservation)
    .map((mark) => mark.text)
    .join(" ");
}

export function evidenceLabel(kind: SentenceMark["kinds"][number]): string {
  if (kind === "survey") return "학생 설문";
  return EVIDENCE_LABEL[kind];
}
