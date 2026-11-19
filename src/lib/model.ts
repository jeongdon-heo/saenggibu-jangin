import { emptySubject } from "./defaults";
import type { AppData, AssessmentItem, ClassInfo, Result, Standard, Student, Subject } from "../types";
import { createId } from "./id";
import { LIMITS } from "./limits";
import { canonicalCode, type ParsedPlanItem, type ParsedStandard, type ParsedStudent } from "./parse";

function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => a.number - b.number);
}

export function sortedStudents(students: Student[]): Student[] {
  return sortStudents(students);
}

export function updateClassInfo(data: AppData, patch: Partial<ClassInfo>): Result<AppData> {
  const next: ClassInfo = { ...data.classInfo, ...patch };
  if (!Number.isInteger(next.schoolYear) || next.schoolYear < 2000 || next.schoolYear > 2100) {
    return { ok: false, error: "학년도는 2000년부터 2100년 사이로 입력해 주세요." };
  }
  if (next.semester !== 1 && next.semester !== 2) {
    return { ok: false, error: "학기는 1학기 또는 2학기입니다." };
  }
  if (next.grade !== null && (!Number.isInteger(next.grade) || next.grade < 1 || next.grade > 6)) {
    return { ok: false, error: "학년은 1학년부터 6학년까지입니다." };
  }
  if (next.classLabel.length > LIMITS.classLabel) {
    return { ok: false, error: "반 이름은 20자 안으로 적어 주세요." };
  }
  return { ok: true, data: { ...data, classInfo: next } };
}

export function addStudent(
  data: AppData,
  input: { number: number; alias: string; realName?: string },
): Result<AppData> {
  if (!Number.isInteger(input.number) || input.number < 1 || input.number > 200) {
    return { ok: false, error: "번호는 1부터 200 사이의 숫자로 입력해 주세요." };
  }
  if (data.students.some((student) => student.number === input.number)) {
    return { ok: false, error: `${input.number}번은 이미 있습니다.` };
  }
  if (data.students.length >= LIMITS.students) {
    return { ok: false, error: `학생은 ${LIMITS.students}명까지 넣을 수 있습니다.` };
  }
  const alias = input.alias.trim();
  const realName = (input.realName ?? "").trim();
  if (alias.length > LIMITS.alias || realName.length > LIMITS.realName) {
    return { ok: false, error: "별칭과 실명은 40자 안으로 적어 주세요." };
  }
  const students = sortStudents([
    ...data.students,
    { id: createId(), number: input.number, alias, realName },
  ]);
  return { ok: true, data: { ...data, students } };
}

export function updateStudent(
  data: AppData,
  id: string,
  patch: Partial<Pick<Student, "number" | "alias" | "realName">>,
): Result<AppData> {
  const current = data.students.find((student) => student.id === id);
  if (!current) return { ok: false, error: "학생을 찾지 못했습니다." };
  const number = patch.number ?? current.number;
  const alias = patch.alias ?? current.alias;
  const realName = patch.realName ?? current.realName;
  if (!Number.isInteger(number) || number < 1 || number > 200) {
    return { ok: false, error: "번호는 1부터 200 사이의 숫자로 입력해 주세요." };
  }
  if (data.students.some((student) => student.id !== id && student.number === number)) {
    return { ok: false, error: `${number}번은 이미 있습니다.` };
  }
  if (alias.length > LIMITS.alias || realName.length > LIMITS.realName) {
    return { ok: false, error: "별칭과 실명은 40자 안으로 적어 주세요." };
  }
  const students = sortStudents(
    data.students.map((student) => (student.id === id ? { ...student, number, alias, realName } : student)),
  );
  return { ok: true, data: { ...data, students } };
}

export function deleteStudent(data: AppData, id: string): AppData {
  return {
    ...data,
    students: data.students.filter((student) => student.id !== id),
    records: data.records.filter((record) => record.studentId !== id),
  };
}

export function applyStudents(
  data: AppData,
  rows: ParsedStudent[],
  mode: "append" | "replace",
): Result<AppData> {
  if (rows.length === 0) return { ok: false, error: "넣을 학생이 없습니다." };
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.number)) return { ok: false, error: `${row.number}번이 중복되었습니다.` };
    seen.add(row.number);
  }

  if (mode === "replace") {
    if (rows.length > LIMITS.students) {
      return { ok: false, error: `학생은 ${LIMITS.students}명까지 넣을 수 있습니다.` };
    }
    const oldByNumber = new Map(data.students.map((student) => [student.number, student]));
    const students = sortStudents(
      rows.map((row) => {
        const old = oldByNumber.get(row.number);
        return {
          id: old?.id ?? createId(),
          number: row.number,
          alias: row.alias.trim(),
          realName: row.realName.trim(),
        };
      }),
    );
    const keep = new Set(students.map((student) => student.id));
    return {
      ok: true,
      data: {
        ...data,
        students,
        records: data.records.filter((record) => keep.has(record.studentId)),
      },
    };
  }

  const students = data.students.map((student) => ({ ...student }));
  for (const row of rows) {
    const existing = students.find((student) => student.number === row.number);
    if (existing) {
      existing.alias = row.alias.trim();
      if (row.realName.trim()) existing.realName = row.realName.trim();
    } else {
      students.push({
        id: createId(),
        number: row.number,
        alias: row.alias.trim(),
        realName: row.realName.trim(),
      });
    }
  }
  if (students.length > LIMITS.students) {
    return { ok: false, error: `학생은 ${LIMITS.students}명까지 넣을 수 있습니다.` };
  }
  return { ok: true, data: { ...data, students: sortStudents(students) } };
}

function subjectOf(data: AppData, subjectId: string): Subject | undefined {
  return data.subjects.find((subject) => subject.id === subjectId);
}

function mapSubject(data: AppData, subjectId: string, mapper: (subject: Subject) => Subject): AppData {
  return {
    ...data,
    subjects: data.subjects.map((subject) => (subject.id === subjectId ? mapper(subject) : subject)),
  };
}

export function addSubject(data: AppData, name: string): Result<AppData> & { id?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "과목 이름을 적어 주세요." };
  if (trimmed.length > LIMITS.subjectName) {
    return { ok: false, error: `과목 이름은 ${LIMITS.subjectName}자 안으로 적어 주세요.` };
  }
  if (data.subjects.some((subject) => subject.name === trimmed)) {
    return { ok: false, error: `${trimmed}은 이미 있습니다.` };
  }
  if (data.subjects.length >= LIMITS.subjects) {
    return { ok: false, error: `과목은 ${LIMITS.subjects}개까지 넣을 수 있습니다.` };
  }
  const id = createId();
  return {
    ok: true,
    id,
    data: {
      ...data,
      subjects: [...data.subjects, emptySubject(id, trimmed)],
    },
  };
}

export function renameSubject(data: AppData, id: string, name: string): Result<AppData> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "과목 이름을 적어 주세요." };
  if (trimmed.length > LIMITS.subjectName) {
    return { ok: false, error: `과목 이름은 ${LIMITS.subjectName}자 안으로 적어 주세요.` };
  }
  if (data.subjects.some((subject) => subject.id !== id && subject.name === trimmed)) {
    return { ok: false, error: `${trimmed}은 이미 있습니다.` };
  }
  if (!subjectOf(data, id)) return { ok: false, error: "과목을 찾지 못했습니다." };
  return { ok: true, data: mapSubject(data, id, (subject) => ({ ...subject, name: trimmed })) };
}

export function deleteSubject(data: AppData, id: string): AppData {
  return {
    ...data,
    subjects: data.subjects.filter((subject) => subject.id !== id),
    records: data.records.filter((record) => record.subjectId !== id),
    questions: data.questions.filter((question) => question.subjectId !== id),
    responses: data.responses
      .map((response) => ({
        ...response,
        answers: response.answers.filter((answer) => data.questions.find((question) => question.id === answer.questionId)?.subjectId !== id),
      }))
      .filter((response) => response.answers.length > 0),
    levelEstimates: data.levelEstimates.filter((estimate) => estimate.subjectId !== id),
  };
}

export function moveSubject(data: AppData, id: string, direction: -1 | 1): AppData {
  const index = data.subjects.findIndex((subject) => subject.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= data.subjects.length) return data;
  const subjects = data.subjects.slice();
  const [item] = subjects.splice(index, 1);
  if (!item) return data;
  subjects.splice(next, 0, item);
  return { ...data, subjects };
}

export function addPlanItem(data: AppData, subjectId: string): Result<AppData> {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다." };
  if (subject.plan.length >= LIMITS.planItems) {
    return { ok: false, error: `평가 항목은 ${LIMITS.planItems}개까지 넣을 수 있습니다.` };
  }
  const item: AssessmentItem = { id: createId(), area: "", content: "", method: "", ratio: "", note: "" };
  return { ok: true, data: mapSubject(data, subjectId, (current) => ({ ...current, plan: [...current.plan, item] })) };
}

export function updatePlanItem(
  data: AppData,
  subjectId: string,
  itemId: string,
  patch: Partial<Omit<AssessmentItem, "id">>,
): AppData {
  return mapSubject(data, subjectId, (subject) => ({
    ...subject,
    plan: subject.plan.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        area: (patch.area ?? item.area).slice(0, LIMITS.shortField),
        content: (patch.content ?? item.content).slice(0, LIMITS.standardText),
        method: (patch.method ?? item.method).slice(0, LIMITS.shortField),
        ratio: (patch.ratio ?? item.ratio).slice(0, LIMITS.shortField),
        note: (patch.note ?? item.note).slice(0, LIMITS.standardText),
      };
    }),
  }));
}

export function deletePlanItem(data: AppData, subjectId: string, itemId: string): AppData {
  return mapSubject(data, subjectId, (subject) => ({
    ...subject,
    plan: subject.plan.filter((item) => item.id !== itemId),
  }));
}

export function addPlanItems(data: AppData, subjectId: string, items: ParsedPlanItem[]): Result<AppData> & { added: number } {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다.", added: 0 };
  const room = LIMITS.planItems - subject.plan.length;
  if (room <= 0) return { ok: false, error: "평가 항목을 더 넣을 수 없습니다.", added: 0 };
  const accepted = items.slice(0, room).map((item) => ({
    id: createId(),
    area: item.area.slice(0, LIMITS.shortField),
    content: item.content.slice(0, LIMITS.standardText),
    method: item.method.slice(0, LIMITS.shortField),
    ratio: item.ratio.slice(0, LIMITS.shortField),
    note: item.note.slice(0, LIMITS.standardText),
  }));
  return {
    ok: true,
    added: accepted.length,
    data: mapSubject(data, subjectId, (current) => ({ ...current, plan: [...current.plan, ...accepted] })),
  };
}

export function addStandard(data: AppData, subjectId: string, code: string, text: string): Result<AppData> {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다." };
  const normalized = canonicalCode(code) ?? code.trim().replace(/^\[|\]$/g, "");
  const body = text.trim();
  if (!normalized || !body) return { ok: false, error: "성취기준 코드와 내용을 모두 적어 주세요." };
  if (normalized.length > 20) return { ok: false, error: "성취기준 코드가 너무 깁니다." };
  if (body.length > LIMITS.standardText) return { ok: false, error: "성취기준 내용이 너무 깁니다." };
  if (subject.standards.some((standard) => standard.code === normalized)) {
    return { ok: false, error: `${normalized}은 이미 있습니다. 목록에서 내용을 고치면 됩니다.` };
  }
  if (subject.standards.length >= LIMITS.standards) {
    return { ok: false, error: "성취기준을 더 넣을 수 없습니다." };
  }
  const standard: Standard = { id: createId(), code: normalized, text: body };
  return {
    ok: true,
    data: mapSubject(data, subjectId, (current) => ({ ...current, standards: [...current.standards, standard] })),
  };
}

export function updateStandard(
  data: AppData,
  subjectId: string,
  standardId: string,
  patch: Partial<Pick<Standard, "code" | "text">>,
): Result<AppData> {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다." };
  const current = subject.standards.find((standard) => standard.id === standardId);
  if (!current) return { ok: false, error: "성취기준을 찾지 못했습니다." };
  const code = (patch.code !== undefined ? canonicalCode(patch.code) ?? patch.code.trim() : current.code).replace(/^\[|\]$/g, "");
  const text = patch.text !== undefined ? patch.text : current.text;
  if (!code.trim()) return { ok: false, error: "성취기준 코드를 적어 주세요." };
  if (code.length > 20 || text.length > LIMITS.standardText) {
    return { ok: false, error: "성취기준이 너무 깁니다." };
  }
  if (subject.standards.some((standard) => standard.id !== standardId && standard.code === code)) {
    return { ok: false, error: `${code}은 이미 있습니다.` };
  }
  return {
    ok: true,
    data: mapSubject(data, subjectId, (item) => ({
      ...item,
      standards: item.standards.map((standard) => (standard.id === standardId ? { ...standard, code, text } : standard)),
    })),
  };
}

export function deleteStandard(data: AppData, subjectId: string, standardId: string): AppData {
  return mapSubject(data, subjectId, (subject) => ({
    ...subject,
    standards: subject.standards.filter((standard) => standard.id !== standardId),
  }));
}

export function mergeStandards(
  data: AppData,
  subjectId: string,
  items: ParsedStandard[],
): Result<AppData> & { added: number; updated: number } {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다.", added: 0, updated: 0 };
  const standards = subject.standards.map((standard) => ({ ...standard }));
  let added = 0;
  let updated = 0;
  for (const item of items) {
    const code = item.code.trim();
    const text = item.text.slice(0, LIMITS.standardText);
    if (!code) continue;
    const found = standards.find((standard) => standard.code === code);
    if (found) {
      if (text) found.text = text;
      updated += 1;
      continue;
    }
    if (standards.length >= LIMITS.standards) {
      return { ok: false, error: "성취기준을 더 넣을 수 없습니다.", added, updated };
    }
    standards.push({ id: createId(), code, text });
    added += 1;
  }
  return {
    ok: true,
    added,
    updated,
    data: mapSubject(data, subjectId, (current) => ({ ...current, standards })),
  };
}

export function findRecord(data: AppData, studentId: string, subjectId: string) {
  return data.records.find((record) => record.studentId === studentId && record.subjectId === subjectId);
}

export function upsertRecord(
  data: AppData,
  studentId: string,
  subjectId: string,
  patch: { notes?: string; draft?: string },
): { data: AppData; capped: boolean } {
  let capped = false;
  const clamp = (value: string) => {
    if (value.length <= LIMITS.writing) return value;
    capped = true;
    return value.slice(0, LIMITS.writing);
  };
  const index = data.records.findIndex((record) => record.studentId === studentId && record.subjectId === subjectId);
  const records = data.records.slice();
  const now = new Date().toISOString();
  if (index === -1) {
    records.push({
      id: createId(),
      studentId,
      subjectId,
      notes: clamp(patch.notes ?? ""),
      draft: clamp(patch.draft ?? ""),
      updatedAt: now,
    });
  } else {
    const current = records[index];
    if (!current) return { data, capped };
    records[index] = {
      ...current,
      notes: patch.notes !== undefined ? clamp(patch.notes) : current.notes,
      draft: patch.draft !== undefined ? clamp(patch.draft) : current.draft,
      updatedAt: now,
    };
  }
  return { data: { ...data, records }, capped };
}
