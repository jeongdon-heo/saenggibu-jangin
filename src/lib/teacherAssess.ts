import type { AppData, EvidenceKind, LevelDecision, Subject, TeacherCheck, Unit } from "../types";
import { createId } from "./id";
import { sortedStudents } from "./model";
import { shownLevel } from "./survey";

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  observe: "관찰",
  paper: "지필",
  performance: "수행평가",
};

export const NOTE_LIMIT = 80;

export function lessonTopics(subject: Subject): Unit[] {
  return subject.units.filter((unit) => !unit.skipped).slice().sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ko"));
}

export function orderedTopics(subject: Subject): Unit[] {
  return subject.units.slice().sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ko"));
}

export function levelLabels(subject: Subject, unit: Unit): string[] {
  const element = subject.elements.find((item) => item.id === unit.elementId);
  const labels = element?.levels.map((level) => level.label).filter(Boolean) ?? [];
  return labels.length > 0 ? labels : ["상", "중", "하"];
}

export function aggregateTeacherLevel(labels: string[], levels: string[]): { level: string; mixed: boolean } {
  const filled = levels.filter(Boolean);
  if (filled.length === 0) return { level: "", mixed: false };
  const counts = new Map<string, number>();
  for (const level of filled) counts.set(level, (counts.get(level) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  const topCount = ranked[0]?.[1] ?? 0;
  const tied = ranked.filter((item) => item[1] === topCount).map((item) => item[0]);
  const mixed = new Set(filled).size > 1;
  if (tied.length === 1) return { level: tied[0] ?? "", mixed };
  const ordered = labels.filter((label) => tied.includes(label));
  return { level: ordered.at(-1) ?? tied[0] ?? "", mixed };
}

export type CombinedLevel = {
  studentId: string;
  subjectId: string;
  elementId: string;
  elementName: string;
  labels: string[];
  surveyLevel: string;
  teacherLevel: string;
  teacherMixed: boolean;
  evidences: EvidenceKind[];
  notes: string[];
  disagree: boolean;
  suggested: string;
  confirmed: string;
  decisionId: string;
};

function decisionFor(data: AppData, studentId: string, subjectId: string, elementId: string): LevelDecision | undefined {
  return data.levelDecisions.find((item) => item.studentId === studentId && item.subjectId === subjectId && item.elementId === elementId);
}

export function combinedFor(data: AppData, subjectId: string, studentId: string): CombinedLevel[] {
  const subject = data.subjects.find((item) => item.id === subjectId);
  if (!subject) return [];
  return subject.elements.map((element) => {
    const labels = element.levels.map((level) => level.label).filter(Boolean);
    const estimate = data.levelEstimates.find((item) => item.studentId === studentId && item.subjectId === subjectId && item.elementId === element.id);
    const checks = data.teacherChecks.filter((check) => {
      if (check.studentId !== studentId || check.subjectId !== subjectId || !check.level && !check.note) return false;
      const unit = subject.units.find((item) => item.id === check.unitId);
      return unit !== undefined && !unit.skipped && unit.elementId === element.id;
    });
    const teacher = aggregateTeacherLevel(labels.length > 0 ? labels : ["상", "중", "하"], checks.map((check) => check.level));
    const surveyLevel = estimate ? shownLevel(estimate) : "";
    const evidences = [...new Set(checks.flatMap((check) => check.evidences))];
    const notes = checks.map((check) => check.note.trim()).filter(Boolean);
    const decision = decisionFor(data, studentId, subjectId, element.id);
    const suggested = teacher.level || surveyLevel;
    return {
      studentId,
      subjectId,
      elementId: element.id,
      elementName: element.name,
      labels: labels.length > 0 ? labels : ["상", "중", "하"],
      surveyLevel,
      teacherLevel: teacher.level,
      teacherMixed: teacher.mixed,
      evidences,
      notes,
      disagree: Boolean(teacher.level && surveyLevel && teacher.level !== surveyLevel),
      suggested,
      confirmed: decision?.confirmed ? decision.level : "",
      decisionId: decision?.id ?? "",
    };
  });
}

export function levelForComment(row: CombinedLevel): string {
  return row.confirmed || row.suggested;
}

export function findCheck(data: AppData, studentId: string, unitId: string): TeacherCheck | undefined {
  return data.teacherChecks.find((check) => check.studentId === studentId && check.unitId === unitId);
}

export function upsertTeacherCheck(
  data: AppData,
  studentId: string,
  subjectId: string,
  unitId: string,
  patch: { level?: string; evidences?: EvidenceKind[]; note?: string },
): AppData {
  const current = findCheck(data, studentId, unitId);
  const next: TeacherCheck = {
    id: current?.id ?? createId(),
    studentId,
    subjectId,
    unitId,
    level: (patch.level ?? current?.level ?? "").slice(0, 20),
    evidences: patch.evidences ?? current?.evidences ?? [],
    note: (patch.note ?? current?.note ?? "").slice(0, NOTE_LIMIT),
  };
  const keep = next.level || next.note || next.evidences.length > 0;
  const rest = data.teacherChecks.filter((check) => check.id !== current?.id);
  return { ...data, teacherChecks: keep ? [...rest, next] : rest };
}

export function bulkSetColumn(data: AppData, subjectId: string, unitId: string, level: string): AppData {
  let next = data;
  for (const student of sortedStudents(data.students)) {
    next = upsertTeacherCheck(next, student.id, subjectId, unitId, { level });
  }
  return next;
}

export function setLevelDecision(data: AppData, studentId: string, subjectId: string, elementId: string, level: string, confirmed: boolean): AppData {
  const current = decisionFor(data, studentId, subjectId, elementId);
  const rest = data.levelDecisions.filter((item) => item.id !== current?.id);
  if (!confirmed) return { ...data, levelDecisions: rest };
  const decision: LevelDecision = {
    id: current?.id ?? createId(),
    studentId,
    subjectId,
    elementId,
    level: level.slice(0, 20),
    confirmed: true,
  };
  return { ...data, levelDecisions: [...rest, decision] };
}

export function toggleEvidence(current: EvidenceKind[], kind: EvidenceKind): EvidenceKind[] {
  return current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind];
}
