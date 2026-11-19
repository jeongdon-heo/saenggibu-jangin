import { defaultAiSettings, emptyData } from "./defaults";
import { LIMITS } from "./limits";
import type {
  AiSettings,
  AppData,
  AssessmentItem,
  ClassInfo,
  EvaluationElement,
  LevelCriterion,
  EvidenceKind,
  LevelDecision,
  LevelEstimate,
  Question,
  TeacherCheck,
  Result,
  SurveyAnswer,
  SurveyResponse,
  Semester,
  Standard,
  Student,
  StudentRecord,
  Subject,
  Unit,
} from "../types";

export const STORAGE_KEY = "saenggibujangin.v1";
export const APP_ID = "saenggibujangin";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type LoadResult = {
  data: AppData;
  warning: string | null;
  persist: boolean;
  rawBackup: string | null;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

export function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function asString(value: unknown, max: number, fallback?: string): string | null {
  if ((value === undefined || value === null) && fallback !== undefined) return fallback;
  if (typeof value !== "string") return null;
  if (value.length > max) return null;
  return value;
}

function normalizeClass(value: unknown): Result<ClassInfo> {
  if (!isRecord(value)) return { ok: false, error: "학급 정보가 없습니다." };
  const schoolYear = asInt(value.schoolYear);
  if (schoolYear === null || schoolYear < 2000 || schoolYear > 2100) {
    return { ok: false, error: "학년도가 올바르지 않습니다." };
  }
  if (value.semester !== 1 && value.semester !== 2) {
    return { ok: false, error: "학기 정보가 올바르지 않습니다." };
  }
  let grade: number | null = null;
  if (value.grade !== null && value.grade !== undefined && value.grade !== "") {
    const parsed = asInt(value.grade);
    if (parsed === null || parsed < 1 || parsed > 6) return { ok: false, error: "학년은 1부터 6까지입니다." };
    grade = parsed;
  }
  const classLabel = asString(value.classLabel, LIMITS.classLabel, "");
  if (classLabel === null) return { ok: false, error: "반 정보가 올바르지 않습니다." };
  const semester = value.semester as Semester;
  return { ok: true, data: { schoolYear, semester, grade, classLabel } };
}

function normalizeStudents(value: unknown): Result<Student[]> {
  if (!Array.isArray(value)) return { ok: false, error: "학생 명단 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.students) return { ok: false, error: "학생 수가 너무 많습니다." };
  const students: Student[] = [];
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "학생 정보의 형식이 맞지 않습니다." };
    const id = asString(item.id, 80);
    const number = asInt(item.number);
    const alias = asString(item.alias, LIMITS.alias, "");
    const realName = asString(item.realName, LIMITS.realName, "");
    if (!id || number === null || number < 1 || number > 200 || alias === null || realName === null) {
      return { ok: false, error: "학생 정보의 형식이 맞지 않습니다." };
    }
    if (ids.has(id) || numbers.has(number)) return { ok: false, error: "학생 번호나 구분값이 겹칩니다." };
    ids.add(id);
    numbers.add(number);
    students.push({ id, number, alias, realName });
  }
  return { ok: true, data: students };
}

function normalizePlan(value: unknown): Result<AssessmentItem[]> {
  if (!Array.isArray(value)) return { ok: false, error: "평가계획 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.planItems) return { ok: false, error: "평가 항목이 너무 많습니다." };
  const items: AssessmentItem[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "평가계획 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const area = asString(item.area, LIMITS.shortField, "");
    const content = asString(item.content, LIMITS.standardText, "");
    const method = asString(item.method, LIMITS.shortField, "");
    const ratio = asString(item.ratio, LIMITS.shortField, "");
    const note = asString(item.note, LIMITS.standardText, "");
    if (!id || area === null || content === null || method === null || ratio === null || note === null) {
      return { ok: false, error: "평가계획 형식이 올바르지 않습니다." };
    }
    if (ids.has(id)) return { ok: false, error: "평가 항목 구분값이 겹칩니다." };
    ids.add(id);
    items.push({ id, area, content, method, ratio, note });
  }
  return { ok: true, data: items };
}

function normalizeStandards(value: unknown): Result<Standard[]> {
  if (!Array.isArray(value)) return { ok: false, error: "성취기준 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.standards) return { ok: false, error: "성취기준이 너무 많습니다." };
  const items: Standard[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "성취기준 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const code = asString(item.code, 20);
    const text = asString(item.text, LIMITS.standardText, "");
    if (!id || !code || text === null) return { ok: false, error: "성취기준 형식이 올바르지 않습니다." };
    if (ids.has(id)) return { ok: false, error: "성취기준 구분값이 겹칩니다." };
    ids.add(id);
    items.push({ id, code, text });
  }
  return { ok: true, data: items };
}

function normalizeSubjects(value: unknown): Result<Subject[]> {
  if (!Array.isArray(value)) return { ok: false, error: "과목 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.subjects) return { ok: false, error: "과목이 너무 많습니다." };
  const subjects: Subject[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "과목 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const name = asString(item.name, LIMITS.subjectName);
    if (!id || !name?.trim()) return { ok: false, error: "과목 이름이 없습니다." };
    if (ids.has(id) || names.has(name)) return { ok: false, error: "과목 이름이나 구분값이 겹칩니다." };
    const plan = normalizePlan(item.plan ?? []);
    if (!plan.ok) return plan;
    const standards = normalizeStandards(item.standards ?? []);
    if (!standards.ok) return standards;
    ids.add(id);
    names.add(name);
    const units = normalizeUnits(item.units ?? []);
    if (!units.ok) return units;
    const elements = normalizeElements(item.elements ?? []);
    if (!elements.ok) return elements;
    ids.add(id);
    names.add(name);
    subjects.push({ id, name, plan: plan.data, standards: standards.data, units: units.data, elements: elements.data });
  }
  return { ok: true, data: subjects };
}

function normalizeUnits(value: unknown): Result<Unit[]> {
  if (!Array.isArray(value)) return { ok: false, error: "단원 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.units) return { ok: false, error: "단원이 너무 많습니다." };
  const units: Unit[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "단원 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const title = asString(item.title, LIMITS.shortField);
    if (!id || !title) return { ok: false, error: "단원 이름이 없습니다." };
    if (ids.has(id)) return { ok: false, error: "단원 구분값이 겹칩니다." };
    const grade = item.grade === null || item.grade === undefined || item.grade === "" ? null : asInt(item.grade);
    const semester = item.semester === null || item.semester === undefined || item.semester === "" ? null : asInt(item.semester);
    if (grade === null && item.grade !== null && item.grade !== undefined && item.grade !== "") {
      return { ok: false, error: "단원 학년이 올바르지 않습니다." };
    }
    ids.add(id);
    units.push({
      id,
      order: asInt(item.order) ?? units.length + 1,
      grade,
      semester: semester === 1 || semester === 2 ? semester : semester === null ? null : null,
      organization: asString(item.organization, LIMITS.shortField, "") ?? "",
      title,
      content: asString(item.content, LIMITS.standardText, "") ?? "",
      pages: asString(item.pages, 40, "") ?? "",
      extraPages: asString(item.extraPages, 40, "") ?? "",
      period: asString(item.period, 40, "") ?? "",
      totalPeriods: asString(item.totalPeriods, 40, "") ?? "",
      materials: asString(item.materials, LIMITS.shortField, "") ?? "",
      skipped: item.skipped === true,
      elementId: asString(item.elementId, 80, "") ?? "",
    });
  }
  return { ok: true, data: units };
}

function normalizeLevels(value: unknown): Result<LevelCriterion[]> {
  if (!Array.isArray(value)) return { ok: false, error: "수준별 기준 형식이 올바르지 않습니다." };
  const levels: LevelCriterion[] = [];
  for (const item of value.slice(0, LIMITS.levels)) {
    if (!isRecord(item)) return { ok: false, error: "수준별 기준 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const label = asString(item.label, 20);
    const description = asString(item.description, LIMITS.standardText, "");
    if (!id || !label || description === null) return { ok: false, error: "수준 라벨이 없습니다." };
    levels.push({ id, label, description });
  }
  return { ok: true, data: levels };
}

function normalizeElements(value: unknown): Result<EvaluationElement[]> {
  if (!Array.isArray(value)) return { ok: false, error: "평가요소 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.elements) return { ok: false, error: "평가요소가 너무 많습니다." };
  const elements: EvaluationElement[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "평가요소 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const name = asString(item.name, LIMITS.shortField);
    if (!id || !name) return { ok: false, error: "평가요소 이름이 없습니다." };
    if (ids.has(id)) return { ok: false, error: "평가요소 구분값이 겹칩니다." };
    const levels = normalizeLevels(item.levels ?? []);
    if (!levels.ok) return levels;
    const codes = Array.isArray(item.standardCodes) ? item.standardCodes.filter((code): code is string => typeof code === "string").slice(0, 12) : [];
    ids.add(id);
    elements.push({
      id,
      name,
      unitId: asString(item.unitId, 80, "") ?? "",
      standardCodes: codes,
      levels: levels.data,
      note: asString(item.note, LIMITS.standardText, "") ?? "",
    });
  }
  return { ok: true, data: elements };
}

function normalizeQuestions(value: unknown, subjects: Subject[]): Result<Question[]> {
  if (value === undefined) return { ok: true, data: [] };
  if (!Array.isArray(value)) return { ok: false, error: "문제 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.questions) return { ok: false, error: "문제가 너무 많습니다." };
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const questions: Question[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "문제 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const subjectId = asString(item.subjectId, 80);
    const prompt = asString(item.prompt, LIMITS.questionText);
    const type = item.type;
    if (!id || !subjectId || !prompt || (type !== "choice" && type !== "short" && type !== "essay" && type !== "check")) {
      return { ok: false, error: "문제 형식이 올바르지 않습니다." };
    }
    if (!subjectIds.has(subjectId) || ids.has(id)) return { ok: false, error: "문제와 과목 연결이 맞지 않습니다." };
    ids.add(id);
    const choices = Array.isArray(item.choices) ? item.choices.filter((choice): choice is string => typeof choice === "string").slice(0, LIMITS.choices) : [];
    questions.push({
      id,
      subjectId,
      elementId: asString(item.elementId, 80, "") ?? "",
      elementName: asString(item.elementName, LIMITS.shortField, "") ?? "",
      standardCodes: Array.isArray(item.standardCodes) ? item.standardCodes.filter((code): code is string => typeof code === "string").slice(0, 12) : [],
      targetLevel: asString(item.targetLevel, 20, "") ?? "",
      type,
      prompt,
      choices,
      answer: asString(item.answer, LIMITS.questionText, "") ?? "",
      rubric: asString(item.rubric, LIMITS.questionText, "") ?? "",
      approved: item.approved === true,
      selected: item.approved === true && item.selected === true,
      order: asInt(item.order) ?? questions.length + 1,
    });
  }
  return { ok: true, data: questions };
}

function normalizeAiSettings(value: unknown): AiSettings {
  if (!isRecord(value)) return defaultAiSettings();
  const provider = value.provider === "openai" || value.provider === "gemini" ? value.provider : "gemini";
  const fallback = provider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash";
  return {
    provider,
    model: asString(value.model, LIMITS.modelName, fallback) || fallback,
    rememberKey: value.rememberKey === true,
  };
}

function normalizeRecords(value: unknown, students: Student[], subjects: Subject[]): Result<StudentRecord[]> {
  if (!Array.isArray(value)) return { ok: false, error: "기록 형식이 올바르지 않습니다." };
  const studentIds = new Set(students.map((student) => student.id));
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const records: StudentRecord[] = [];
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "기록 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const studentId = asString(item.studentId, 80);
    const subjectId = asString(item.subjectId, 80);
    const notes = asString(item.notes, LIMITS.writing, "");
    const draft = asString(item.draft, LIMITS.writing, "");
    const observation = asString(item.observation, LIMITS.writing, "");
    const updatedAt = asString(item.updatedAt, 40, "");
    if (!id || !studentId || !subjectId || notes === null || draft === null || observation === null || updatedAt === null) {
      return { ok: false, error: "기록 형식이 올바르지 않습니다." };
    }
    if (!studentIds.has(studentId) || !subjectIds.has(subjectId)) {
      return { ok: false, error: "기록과 학생·과목 연결이 맞지 않습니다." };
    }
    if (ids.has(id)) return { ok: false, error: "기록 구분값이 겹칩니다." };
    const pair = `${studentId}:${subjectId}`;
    if (pairs.has(pair)) continue;
    ids.add(id);
    pairs.add(pair);
    records.push({
      id,
      studentId,
      subjectId,
      notes,
      draft,
      observation,
      draftConfirmed: item.draftConfirmed === true,
      observationConfirmed: item.observationConfirmed === true,
      updatedAt,
    });
  }
  return { ok: true, data: records };
}

export function normalizeAppData(value: unknown): Result<AppData> {
  if (!isRecord(value)) return { ok: false, error: "생기부장인 백업 파일이 아닙니다." };
  if (![1, 2, 3, 4].includes(Number(value.version))) return { ok: false, error: "이 버전에서 열 수 없는 백업 파일입니다." };
  const classInfo = normalizeClass(value.classInfo);
  if (!classInfo.ok) return classInfo;
  const students = normalizeStudents(value.students ?? []);
  if (!students.ok) return students;
  const subjects = normalizeSubjects(value.subjects ?? []);
  if (!subjects.ok) return subjects;
  const records = normalizeRecords(value.records ?? [], students.data, subjects.data);
  if (!records.ok) return records;
  const questions = normalizeQuestions(value.questions, subjects.data);
  if (!questions.ok) return questions;
  const responses = normalizeResponses(value.responses, students.data, questions.data);
  if (!responses.ok) return responses;
  const levelEstimates = normalizeEstimates(value.levelEstimates, students.data, subjects.data);
  if (!levelEstimates.ok) return levelEstimates;
  const teacherChecks = normalizeChecks(value.teacherChecks, students.data, subjects.data);
  if (!teacherChecks.ok) return teacherChecks;
  const levelDecisions = normalizeDecisions(value.levelDecisions, students.data, subjects.data);
  if (!levelDecisions.ok) return levelDecisions;
  return {
    ok: true,
    data: {
      version: 3,
      classInfo: classInfo.data,
      students: students.data,
      subjects: subjects.data,
      records: records.data,
      questions: questions.data,
      responses: responses.data,
      levelEstimates: levelEstimates.data,
      teacherChecks: teacherChecks.data,
      levelDecisions: levelDecisions.data,
      aiSettings: normalizeAiSettings(value.aiSettings),
    },
  };
}

function normalizeResponses(value: unknown, students: Student[], questions: Question[]): Result<SurveyResponse[]> {
  if (value === undefined) return { ok: true, data: [] };
  if (!Array.isArray(value)) return { ok: false, error: "응답 형식이 올바르지 않습니다." };
  if (value.length > LIMITS.responses) return { ok: false, error: "응답이 너무 많습니다." };
  const studentIds = new Set(students.map((student) => student.id));
  const questionIds = new Set(questions.map((question) => question.id));
  const responses: SurveyResponse[] = [];
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "응답 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const numberText = asString(item.numberText, 20, "");
    if (!id || numberText === null) return { ok: false, error: "응답 형식이 올바르지 않습니다." };
    const studentId = item.studentId === null || item.studentId === undefined || item.studentId === "" ? null : asString(item.studentId, 80);
    if (studentId && !studentIds.has(studentId)) return { ok: false, error: "응답과 학생 연결이 맞지 않습니다." };
    if (!Array.isArray(item.answers)) return { ok: false, error: "응답 형식이 올바르지 않습니다." };
    const answers: SurveyAnswer[] = [];
    for (const answer of item.answers) {
      if (!isRecord(answer)) return { ok: false, error: "응답 형식이 올바르지 않습니다." };
      const questionId = asString(answer.questionId, 80);
      const raw = asString(answer.raw, LIMITS.questionText, "");
      if (!questionId || !questionIds.has(questionId) || raw === null) return { ok: false, error: "응답 문항 연결이 맞지 않습니다." };
      const autoScore = answer.autoScore;
      const teacherScore = answer.teacherScore;
      if (autoScore !== "correct" && autoScore !== "incorrect" && autoScore !== "partial" && autoScore !== "unscored") {
        return { ok: false, error: "채점 형식이 올바르지 않습니다." };
      }
      if (teacherScore !== "" && teacherScore !== "correct" && teacherScore !== "incorrect" && teacherScore !== "partial") {
        return { ok: false, error: "채점 형식이 올바르지 않습니다." };
      }
      answers.push({
        questionId,
        raw,
        autoScore,
        teacherScore,
        note: asString(answer.note, LIMITS.standardText, "") ?? "",
      });
    }
    responses.push({
      id,
      studentId,
      numberText,
      submittedAt: asString(item.submittedAt, 80, "") ?? "",
      answers,
    });
  }
  return { ok: true, data: responses };
}

function normalizeEstimates(value: unknown, students: Student[], subjects: Subject[]): Result<LevelEstimate[]> {
  if (value === undefined) return { ok: true, data: [] };
  if (!Array.isArray(value)) return { ok: false, error: "수준 추정 형식이 올바르지 않습니다." };
  const studentIds = new Set(students.map((student) => student.id));
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const estimates: LevelEstimate[] = [];
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "수준 추정 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const studentId = asString(item.studentId, 80);
    const subjectId = asString(item.subjectId, 80);
    if (!id || !studentId || !subjectId || !studentIds.has(studentId) || !subjectIds.has(subjectId)) {
      return { ok: false, error: "수준 추정과 학생 연결이 맞지 않습니다." };
    }
    estimates.push({
      id,
      studentId,
      subjectId,
      elementId: asString(item.elementId, 80, "") ?? "",
      elementName: asString(item.elementName, LIMITS.shortField, "") ?? "",
      suggestedLevel: asString(item.suggestedLevel, 20, "") ?? "",
      teacherLevel: asString(item.teacherLevel, 20, "") ?? "",
      note: asString(item.note, LIMITS.standardText, "") ?? "",
    });
  }
  return { ok: true, data: estimates };
}

function asEvidence(value: unknown): EvidenceKind[] {
  if (!Array.isArray(value)) return [];
  const kinds: EvidenceKind[] = [];
  for (const item of value) {
    if ((item === "observe" || item === "paper" || item === "performance") && !kinds.includes(item)) kinds.push(item);
  }
  return kinds;
}

function normalizeChecks(value: unknown, students: Student[], subjects: Subject[]): Result<TeacherCheck[]> {
  if (value === undefined) return { ok: true, data: [] };
  if (!Array.isArray(value)) return { ok: false, error: "교사 평가 형식이 올바르지 않습니다." };
  const studentIds = new Set(students.map((student) => student.id));
  const unitIds = new Map(subjects.flatMap((subject) => subject.units.map((unit) => [unit.id, subject.id] as const)));
  const checks: TeacherCheck[] = [];
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "교사 평가 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const studentId = asString(item.studentId, 80);
    const unitId = asString(item.unitId, 80);
    const subjectId = unitId ? unitIds.get(unitId) : undefined;
    if (!id || !studentId || !unitId || !subjectId || !studentIds.has(studentId)) continue;
    checks.push({
      id,
      studentId,
      subjectId,
      unitId,
      level: (asString(item.level, 20, "") ?? "").slice(0, 20),
      evidences: asEvidence(item.evidences),
      note: (asString(item.note, 200, "") ?? "").slice(0, 80),
    });
  }
  return { ok: true, data: checks };
}

function normalizeDecisions(value: unknown, students: Student[], subjects: Subject[]): Result<LevelDecision[]> {
  if (value === undefined) return { ok: true, data: [] };
  if (!Array.isArray(value)) return { ok: false, error: "확정 수준 형식이 올바르지 않습니다." };
  const studentIds = new Set(students.map((student) => student.id));
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const decisions: LevelDecision[] = [];
  for (const item of value) {
    if (!isRecord(item)) return { ok: false, error: "확정 수준 형식이 올바르지 않습니다." };
    const id = asString(item.id, 80);
    const studentId = asString(item.studentId, 80);
    const subjectId = asString(item.subjectId, 80);
    const elementId = asString(item.elementId, 80, "") ?? "";
    if (!id || !studentId || !subjectId || !studentIds.has(studentId) || !subjectIds.has(subjectId)) continue;
    if (item.confirmed !== true) continue;
    decisions.push({
      id,
      studentId,
      subjectId,
      elementId,
      level: (asString(item.level, 20, "") ?? "").slice(0, 20),
      confirmed: true,
    });
  }
  return { ok: true, data: decisions };
}

export function serializeBackup(data: AppData, exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ app: APP_ID, exportedAt, data }, null, 2);
}

export function parseBackup(raw: string): Result<AppData> {
  if (raw.length > LIMITS.backupChars) return { ok: false, error: "파일이 너무 큽니다." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "파일 내용을 읽지 못했습니다. 생기부장인 백업 파일인지 확인해 주세요." };
  }
  if (!isRecord(parsed)) return { ok: false, error: "생기부장인 백업 파일이 아닙니다." };
  const body = parsed.app === APP_ID && "data" in parsed ? parsed.data : parsed;
  return normalizeAppData(body);
}

export function saveTo(storage: StorageLike, data: AppData): SaveResult {
  try {
    storage.setItem(STORAGE_KEY, serializeBackup(data));
    return { ok: true };
  } catch {
    return { ok: false, error: "이 브라우저에 저장하지 못했습니다. 백업 파일을 받아 두세요." };
  }
}

export function loadFrom(storage: StorageLike): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      data: emptyData(),
      warning: "저장된 기록을 읽지 못했습니다.",
      persist: false,
      rawBackup: null,
    };
  }
  if (!raw) return { data: emptyData(), warning: null, persist: true, rawBackup: null };
  const parsed = parseBackup(raw);
  if (!parsed.ok) {
    return {
      data: emptyData(),
      warning: "이 브라우저에 저장된 기록을 읽지 못했습니다. 내려받거나, 백업 파일을 불러오거나, 지우고 새로 시작하세요.",
      persist: false,
      rawBackup: raw,
    };
  }
  return { data: parsed.data, warning: null, persist: true, rawBackup: null };
}

let browserStorage: { storage: StorageLike; warning: string | null } | null = null;

export function getBrowserStorage(): { storage: StorageLike; warning: string | null } {
  if (browserStorage) return browserStorage;
  try {
    const probe = "__saenggi_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    browserStorage = { storage: window.localStorage, warning: null };
  } catch {
    browserStorage = {
      storage: createMemoryStorage(),
      warning: "이 브라우저에는 기록을 남겨 둘 수 없습니다. 창을 닫으면 사라지니 백업 파일을 바로 저장해 주세요.",
    };
  }
  return browserStorage;
}
