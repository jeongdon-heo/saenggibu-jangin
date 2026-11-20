import type { AppData, EvaluationElement, LevelCriterion, Question, QuestionTypeId, Result, Unit } from "../types";
import { createId } from "./id";
import { LIMITS } from "./limits";
import type { ParsedElement } from "./elementsParse";
import type { ParsedUnit } from "./progressSheet";
import { suggestSkip } from "./topics";
import type { ParsedQuestion } from "./questionParse";
import { buildQuestionPrompt, type PromptContext } from "./prompt";

function subjectOf(data: AppData, subjectId: string) {
  return data.subjects.find((subject) => subject.id === subjectId);
}

function mapSubject(data: AppData, subjectId: string, mapper: (subject: AppData["subjects"][number]) => AppData["subjects"][number]): AppData {
  return {
    ...data,
    subjects: data.subjects.map((subject) => (subject.id === subjectId ? mapper(subject) : subject)),
  };
}

export function addUnits(data: AppData, subjectId: string, units: ParsedUnit[], mode: "append" | "replace"): Result<AppData> {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다." };
  const created: Unit[] = units.map((unit) => ({
    ...unit,
    id: createId(),
    skipped: suggestSkip(unit.title, unit.content),
    elementId: "",
  }));
  const next = mode === "replace" ? created : [...subject.units, ...created];
  if (next.length > LIMITS.units) return { ok: false, error: `단원은 ${LIMITS.units}개까지 넣을 수 있습니다.` };
  const removed = new Set(mode === "replace" ? subject.units.map((unit) => unit.id) : []);
  return {
    ok: true,
    data: {
      ...mapSubject(data, subjectId, (current) => ({
        ...current,
        units: next,
        elements: current.elements.map((element) => (removed.has(element.unitId) ? { ...element, unitId: "" } : element)),
      })),
    },
  };
}

export function deleteUnit(data: AppData, subjectId: string, unitId: string): AppData {
  return {
    ...mapSubject(data, subjectId, (subject) => ({
      ...subject,
      units: subject.units.filter((unit) => unit.id !== unitId),
      elements: subject.elements.map((element) => (element.unitId === unitId ? { ...element, unitId: "" } : element)),
    })),
    teacherChecks: data.teacherChecks.filter((check) => check.unitId !== unitId),
  };
}

export function updateUnit(
  data: AppData,
  subjectId: string,
  unitId: string,
  patch: { skipped?: boolean; elementId?: string },
): AppData {
  return mapSubject(data, subjectId, (subject) => ({
    ...subject,
    units: subject.units.map((unit) => (unit.id === unitId ? { ...unit, ...patch } : unit)),
    elements: subject.elements.map((element) => {
      if (patch.elementId && element.id === patch.elementId && !element.unitId) return { ...element, unitId };
      return element;
    }),
  }));
}

export function applySkipSuggestions(data: AppData, subjectId: string): AppData {
  return mapSubject(data, subjectId, (subject) => ({
    ...subject,
    units: subject.units.map((unit) => (suggestSkip(unit.title, unit.content) ? { ...unit, skipped: true } : unit)),
  }));
}

function levelsFrom(items: Array<{ label: string; description: string }>): LevelCriterion[] {
  return items.slice(0, LIMITS.levels).map((item) => ({
    id: createId(),
    label: item.label.slice(0, 20),
    description: item.description.slice(0, LIMITS.standardText),
  }));
}

function elementNameKey(name: string): string {
  return name.replace(/\s+/g, "").trim();
}

function unitForTitle(subject: { units: Unit[] }, title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const unit = subject.units.find((candidate) => candidate.title === trimmed || candidate.title.includes(trimmed));
  return unit?.id ?? "";
}

function noteWithUnit(note: string, unitTitle: string, unitId: string): string {
  const title = unitTitle.trim();
  const body = note.trim();
  if (!title || unitId) return body.slice(0, LIMITS.standardText);
  const prefix = `단원: ${title}`;
  if (body.includes(prefix)) return body.slice(0, LIMITS.standardText);
  return [prefix, body].filter(Boolean).join(" ").slice(0, LIMITS.standardText);
}

export function addElements(data: AppData, subjectId: string, items: ParsedElement[]): Result<AppData> & { added: number } {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다.", added: 0 };
  const room = LIMITS.elements - subject.elements.length;
  if (room <= 0) return { ok: false, error: "평가요소를 더 넣을 수 없습니다.", added: 0 };
  const created: EvaluationElement[] = items.slice(0, room).map((item) => ({
    id: createId(),
    name: item.name.slice(0, LIMITS.shortField),
    unitId: unitForTitle(subject, item.unitTitle),
    standardCodes: item.standardCodes.slice(0, 12),
    levels: levelsFrom(item.levels),
    note: item.note.slice(0, LIMITS.standardText),
  }));
  return {
    ok: true,
    added: created.length,
    data: mapSubject(data, subjectId, (current) => ({ ...current, elements: [...current.elements, ...created] })),
  };
}

export function mergeElements(
  data: AppData,
  subjectId: string,
  items: ParsedElement[],
): Result<AppData> & { added: number; updated: number; skipped: number } {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다.", added: 0, updated: 0, skipped: 0 };
  const elements = subject.elements.map((element) => ({
    ...element,
    standardCodes: [...element.standardCodes],
    levels: element.levels.map((level) => ({ ...level })),
  }));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const item of items) {
    const name = item.name.replace(/\s+/g, " ").trim().slice(0, LIMITS.shortField);
    if (!name) continue;
    const found = elements.find((element) => elementNameKey(element.name) === elementNameKey(name));
    if (!found) {
      if (elements.length >= LIMITS.elements) {
        return { ok: false, error: "평가요소를 더 넣을 수 없습니다.", added, updated, skipped };
      }
      const unitId = unitForTitle(subject, item.unitTitle);
      elements.push({
        id: createId(),
        name,
        unitId,
        standardCodes: [...new Set(item.standardCodes)].slice(0, 12),
        levels: levelsFrom(item.levels),
        note: noteWithUnit(item.note, item.unitTitle, unitId),
      });
      added += 1;
      continue;
    }
    let changed = false;
    if (!found.unitId) {
      const unitId = unitForTitle(subject, item.unitTitle);
      if (unitId) {
        found.unitId = unitId;
        changed = true;
      }
    }
    for (const code of item.standardCodes) {
      if (!code || found.standardCodes.includes(code) || found.standardCodes.length >= 12) continue;
      found.standardCodes.push(code);
      changed = true;
    }
    const noted = noteWithUnit(found.note || item.note, found.unitId ? "" : item.unitTitle, found.unitId);
    if (noted !== found.note) {
      found.note = noted;
      changed = true;
    }
    for (const level of item.levels) {
      const label = level.label.trim().slice(0, 20);
      const description = level.description.trim().slice(0, LIMITS.standardText);
      if (!label && !description) continue;
      const existing = found.levels.find((current) => current.label.replace(/\s+/g, "") === label.replace(/\s+/g, ""));
      if (!existing) {
        if (found.levels.length >= LIMITS.levels) continue;
        found.levels.push({ id: createId(), label, description });
        changed = true;
        continue;
      }
      if (!existing.description && description) {
        existing.description = description;
        changed = true;
      }
    }
    if (changed) updated += 1;
    else skipped += 1;
  }
  return {
    ok: true,
    added,
    updated,
    skipped,
    data: mapSubject(data, subjectId, (current) => ({ ...current, elements })),
  };
}

export function updateElement(data: AppData, subjectId: string, elementId: string, patch: Partial<Omit<EvaluationElement, "id" | "levels">> & { levels?: LevelCriterion[] }): Result<AppData> {
  const subject = subjectOf(data, subjectId);
  if (!subject?.elements.some((element) => element.id === elementId)) return { ok: false, error: "평가요소를 찾지 못했습니다." };
  return {
    ok: true,
    data: mapSubject(data, subjectId, (current) => ({
      ...current,
      elements: current.elements.map((element) => {
        if (element.id !== elementId) return element;
        return {
          ...element,
          ...patch,
          name: (patch.name ?? element.name).slice(0, LIMITS.shortField),
          levels: (patch.levels ?? element.levels).slice(0, LIMITS.levels),
        };
      }),
    })),
  };
}

export function deleteElement(data: AppData, subjectId: string, elementId: string): AppData {
  return {
    ...mapSubject(data, subjectId, (subject) => ({
      ...subject,
      elements: subject.elements.filter((element) => element.id !== elementId),
      units: subject.units.map((unit) => (unit.elementId === elementId ? { ...unit, elementId: "" } : unit)),
    })),
    questions: data.questions.map((question) => (question.elementId === elementId ? { ...question, elementId: "" } : question)),
    levelDecisions: data.levelDecisions.filter((decision) => decision.elementId !== elementId),
  };
}

export function questionsFor(data: AppData, subjectId: string): Question[] {
  return data.questions.filter((question) => question.subjectId === subjectId).sort((a, b) => a.order - b.order);
}

function nextOrder(data: AppData, subjectId: string): number {
  return questionsFor(data, subjectId).reduce((max, question) => Math.max(max, question.order), 0) + 1;
}

export function addParsedQuestions(data: AppData, subjectId: string, items: ParsedQuestion[]): Result<AppData> {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다." };
  if (data.questions.length + items.length > LIMITS.questions) return { ok: false, error: "문제를 더 넣을 수 없습니다." };
  let order = nextOrder(data, subjectId);
  const created: Question[] = items.map((item) => {
    const element = subject.elements.find((candidate) => candidate.name === item.element);
    const question: Question = {
      id: createId(),
      subjectId,
      elementId: element?.id ?? "",
      elementName: item.element || element?.name || "",
      standardCodes: item.standardCodes.length > 0 ? item.standardCodes : element?.standardCodes ?? [],
      targetLevel: item.targetLevel,
      type: item.type,
      prompt: item.prompt.slice(0, LIMITS.questionText),
      choices: item.choices.slice(0, LIMITS.choices),
      answer: item.answer.slice(0, LIMITS.questionText),
      rubric: item.rubric.slice(0, LIMITS.questionText),
      approved: false,
      selected: false,
      order,
    };
    order += 1;
    return question;
  });
  return { ok: true, data: { ...data, questions: [...data.questions, ...created] } };
}

export function updateQuestion(data: AppData, questionId: string, patch: Partial<Omit<Question, "id" | "subjectId" | "order">>): AppData {
  return {
    ...data,
    questions: data.questions.map((question) => {
      if (question.id !== questionId) return question;
      const next = { ...question, ...patch };
      if (next.approved === false) next.selected = false;
      return next;
    }),
  };
}

export function deleteQuestion(data: AppData, questionId: string): AppData {
  return { ...data, questions: data.questions.filter((question) => question.id !== questionId) };
}

export function moveQuestion(data: AppData, questionId: string, direction: -1 | 1): AppData {
  const current = data.questions.find((question) => question.id === questionId);
  if (!current) return data;
  const list = questionsFor(data, current.subjectId);
  const index = list.findIndex((question) => question.id === questionId);
  const neighbor = list[index + direction];
  if (!neighbor) return data;
  return {
    ...data,
    questions: data.questions.map((question) => {
      if (question.id === current.id) return { ...question, order: neighbor.order };
      if (question.id === neighbor.id) return { ...question, order: current.order };
      return question;
    }),
  };
}

export function replaceQuestionContent(data: AppData, questionId: string, item: ParsedQuestion): AppData {
  return {
    ...data,
    questions: data.questions.map((question) => {
      if (question.id !== questionId) return question;
      return {
        ...question,
        elementName: item.element || question.elementName,
        standardCodes: item.standardCodes.length > 0 ? item.standardCodes : question.standardCodes,
        targetLevel: item.targetLevel || question.targetLevel,
        type: item.type,
        prompt: item.prompt.slice(0, LIMITS.questionText),
        choices: item.choices.slice(0, LIMITS.choices),
        answer: item.answer.slice(0, LIMITS.questionText),
        rubric: item.rubric.slice(0, LIMITS.questionText),
        approved: false,
        selected: false,
      };
    }),
  };
}

export function buildContextForElements(data: AppData, subjectId: string, elementIds: string[], counts: Array<{ type: QuestionTypeId; count: number }>): Result<PromptContext> {
  const subject = subjectOf(data, subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다." };
  const elements = subject.elements.filter((element) => elementIds.includes(element.id));
  if (elements.length === 0) return { ok: false, error: "평가요소를 하나 이상 골라 주세요." };
  if (elements.some((element) => element.levels.length === 0)) {
    return { ok: false, error: "수준별 기준이 없는 평가요소가 있습니다. 상/중/하처럼 학교 라벨을 먼저 적어 주세요." };
  }
  const requested = counts.filter((item) => item.count > 0);
  if (requested.length === 0) return { ok: false, error: "만들 문제 유형과 개수를 정해 주세요." };
  if (requested.some((item) => item.count > 10) || requested.reduce((sum, item) => sum + item.count, 0) > 20) {
    return { ok: false, error: "한 번에 20문제, 유형마다 10문제까지 만들 수 있습니다." };
  }
  return {
    ok: true,
    data: {
      grade: data.classInfo.grade,
      semester: data.classInfo.semester,
      subject: subject.name,
      counts: requested,
      items: elements.map((element) => {
        const unit = subject.units.find((item) => item.id === element.unitId);
        return {
          element: element.name,
          unitTitle: unit?.title ?? "",
          unitContent: unit?.content ?? "",
          standards: element.standardCodes.map((code) => ({
            code,
            text: subject.standards.find((standard) => standard.code === code)?.text ?? "",
          })),
          levels: element.levels.map((level) => ({ label: level.label, description: level.description })),
        };
      }),
    },
  };
}

export function promptForElements(data: AppData, subjectId: string, elementIds: string[], counts: Array<{ type: QuestionTypeId; count: number }>): Result<string> {
  const context = buildContextForElements(data, subjectId, elementIds, counts);
  if (!context.ok) return context;
  return { ok: true, data: buildQuestionPrompt(context.data) };
}

export function singleQuestionCounts(type: QuestionTypeId): Array<{ type: QuestionTypeId; count: number }> {
  return [{ type, count: 1 }];
}
