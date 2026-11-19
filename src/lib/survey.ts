import type { AppData, LevelEstimate, Question, Result, ScoreMark, Student, SurveyAnswer, SurveyResponse } from "../types";
import { createId } from "./id";
import { LIMITS } from "./limits";

export type CsvTable = { headers: string[]; rows: string[][] };

export function parseCsv(text: string): CsvTable {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const filled = rows.filter((line) => line.some((value) => value.trim()));
  const [headers = [], ...body] = filled;
  return { headers, rows: body };
}

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function matchStudentNumber(value: string, students: Student[]): { number: number | null; student: Student | null } {
  const trimmed = value.trim().replace(/번$/, "").trim();
  if (!/^\d+$/.test(trimmed)) return { number: null, student: null };
  const number = Number(trimmed);
  return { number, student: students.find((student) => student.number === number) ?? null };
}

export function scoreObjective(question: Question, raw: string): ScoreMark {
  if (question.type === "essay" || question.type === "check") return "unscored";
  const got = normalizeAnswer(raw);
  if (!got) return "unscored";
  if (question.type === "choice") return got === normalizeAnswer(question.answer) ? "correct" : "incorrect";
  const keys = question.answer
    .split(/[/|]/)
    .map(normalizeAnswer)
    .filter(Boolean);
  return keys.some((key) => key === got) ? "correct" : "incorrect";
}

export function effectiveScore(answer: Pick<SurveyAnswer, "autoScore" | "teacherScore">): ScoreMark {
  return answer.teacherScore || answer.autoScore;
}

export function suggestLevel(labels: string[], correct: number, partial: number, total: number): string {
  if (labels.length === 0 || total === 0) return "";
  const ratio = (correct + partial * 0.5) / total;
  if (labels.length === 1) return labels[0] ?? "";
  if (labels.length === 2) return ratio >= 0.65 ? (labels[0] ?? "") : (labels[1] ?? "");
  const middle = labels[Math.floor((labels.length - 1) / 2)] ?? "";
  if (ratio >= 0.8) return labels[0] ?? "";
  if (ratio >= 0.45) return middle;
  return labels[labels.length - 1] ?? "";
}

function compact(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function findNumberColumn(headers: string[]): number {
  return headers.findIndex((header) => {
    const name = compact(header);
    return name === "번호" || (name.endsWith("번호") && !name.includes("이름"));
  });
}

function isTimestamp(header: string): boolean {
  const name = compact(header).toLowerCase();
  return name.includes("타임스탬프") || name === "timestamp" || name.includes("제출시간");
}

function matchQuestion(header: string, questions: Question[]): Question | null {
  const name = compact(header);
  const exact = questions.find((question) => compact(question.prompt) === name);
  if (exact) return exact;
  return (
    questions.find((question) => {
      const prompt = compact(question.prompt);
      return prompt.length >= 8 && (name.startsWith(prompt) || prompt.startsWith(name));
    }) ?? null
  );
}

export type ParsedSurvey = {
  responses: Array<Omit<SurveyResponse, "id"> & { id?: string }>;
  unknownNumbers: string[];
  unmatchedHeaders: string[];
  matchedByOrder: boolean;
};

export function parseSurveyTable(table: CsvTable, questions: Question[], students: Student[]): Result<ParsedSurvey> {
  if (table.headers.length === 0) return { ok: false, error: "표의 첫 줄에 문항 이름이 없습니다." };
  const numberIndex = findNumberColumn(table.headers);
  if (numberIndex < 0) return { ok: false, error: "번호 열을 찾지 못했습니다. 구글 폼의 첫 문항 이름이 ‘번호’인지 확인해 주세요." };
  const selected = questions.filter((question) => question.approved && question.selected).sort((a, b) => a.order - b.order);
  const columnQuestions: Array<Question | null> = table.headers.map((header, index) => {
    if (index === numberIndex || isTimestamp(header)) return null;
    return matchQuestion(header, selected);
  });
  const matchedCount = columnQuestions.filter(Boolean).length;
  let matchedByOrder = false;
  if (matchedCount === 0) {
    const answerColumns = table.headers
      .map((header, index) => ({ header, index }))
      .filter((item) => item.index !== numberIndex && !isTimestamp(item.header));
    if (answerColumns.length === selected.length && selected.length > 0) {
      matchedByOrder = true;
      answerColumns.forEach((item, offset) => {
        columnQuestions[item.index] = selected[offset] ?? null;
      });
    }
  }
  if (columnQuestions.every((question) => question === null)) {
    return { ok: false, error: "응답 열을 만든 문제와 연결하지 못했습니다. 폼의 문항 이름이 앱의 문제와 같은지 확인해 주세요." };
  }
  const unmatchedHeaders = table.headers.filter((header, index) => index !== numberIndex && !isTimestamp(header) && !columnQuestions[index]);
  if (table.rows.length > LIMITS.responses) return { ok: false, error: `응답은 ${LIMITS.responses}개까지 불러올 수 있습니다.` };
  const timestampIndex = table.headers.findIndex(isTimestamp);
  const responses: ParsedSurvey["responses"] = [];
  const unknownNumbers: string[] = [];
  for (const line of table.rows) {
    const numberText = (line[numberIndex] ?? "").trim();
    if (!numberText) continue;
    const matched = matchStudentNumber(numberText, students);
    if (!matched.student && !unknownNumbers.includes(numberText)) unknownNumbers.push(numberText);
    const answers: SurveyAnswer[] = [];
    columnQuestions.forEach((question, index) => {
      if (!question) return;
      const raw = (line[index] ?? "").trim().slice(0, LIMITS.questionText);
      answers.push({
        questionId: question.id,
        raw,
        autoScore: scoreObjective(question, raw),
        teacherScore: "",
        note: "",
      });
    });
    responses.push({
      studentId: matched.student?.id ?? null,
      numberText,
      submittedAt: timestampIndex >= 0 ? (line[timestampIndex] ?? "").trim() : "",
      answers,
    });
  }
  if (responses.length === 0) return { ok: false, error: "번호가 적힌 응답이 없습니다." };
  return { ok: true, data: { responses, unknownNumbers, unmatchedHeaders, matchedByOrder } };
}

function answerKey(response: { studentId: string | null; numberText: string }, answer: SurveyAnswer): string {
  return `${response.studentId ?? response.numberText}:${answer.questionId}:${answer.raw}`;
}

export function keepTeacherMarks(previous: SurveyResponse[], next: SurveyResponse[]): SurveyResponse[] {
  const marks = new Map<string, Pick<SurveyAnswer, "teacherScore" | "note">>();
  for (const response of previous) {
    for (const answer of response.answers) {
      if (answer.teacherScore || answer.note) marks.set(answerKey(response, answer), { teacherScore: answer.teacherScore, note: answer.note });
    }
  }
  return next.map((response) => ({
    ...response,
    answers: response.answers.map((answer) => {
      const saved = marks.get(answerKey(response, answer));
      return saved ? { ...answer, ...saved } : answer;
    }),
  }));
}

export function latestResponses(responses: SurveyResponse[]): SurveyResponse[] {
  const byStudent = new Map<string, SurveyResponse>();
  const unmatched: SurveyResponse[] = [];
  for (const response of responses) {
    const key = response.studentId ?? "";
    if (!key) {
      unmatched.push(response);
      continue;
    }
    const current = byStudent.get(key);
    if (!current || response.submittedAt >= current.submittedAt) byStudent.set(key, response);
  }
  return [...byStudent.values(), ...unmatched];
}

export function aggregateLevels(data: AppData, responses: SurveyResponse[]): LevelEstimate[] {
  const latest = latestResponses(responses);
  const estimates: LevelEstimate[] = [];
  for (const response of latest) {
    if (!response.studentId) continue;
    const byElement = new Map<string, { subjectId: string; elementId: string; elementName: string; labels: string[]; correct: number; partial: number; total: number }>();
    for (const answer of response.answers) {
      const question = data.questions.find((item) => item.id === answer.questionId);
      if (!question) continue;
      const score = effectiveScore(answer);
      if (score === "unscored") continue;
      const subject = data.subjects.find((item) => item.id === question.subjectId);
      const element = subject?.elements.find((item) => item.id === question.elementId);
      const elementId = question.elementId || question.elementName;
      const bucket = byElement.get(elementId) ?? {
        subjectId: question.subjectId,
        elementId: question.elementId,
        elementName: element?.name || question.elementName,
        labels: element?.levels.map((level) => level.label).filter(Boolean) ?? [],
        correct: 0,
        partial: 0,
        total: 0,
      };
      bucket.total += 1;
      if (score === "correct") bucket.correct += 1;
      if (score === "partial") bucket.partial += 1;
      byElement.set(elementId, bucket);
    }
    for (const bucket of byElement.values()) {
      const previous = data.levelEstimates.find((item) => item.studentId === response.studentId && item.elementId === bucket.elementId && item.subjectId === bucket.subjectId);
      estimates.push({
        id: previous?.id ?? createId(),
        studentId: response.studentId,
        subjectId: bucket.subjectId,
        elementId: bucket.elementId,
        elementName: bucket.elementName,
        suggestedLevel: suggestLevel(bucket.labels, bucket.correct, bucket.partial, bucket.total),
        teacherLevel: previous?.teacherLevel ?? "",
        note: previous?.note ?? "",
      });
    }
  }
  return estimates;
}

export type ImportReport = {
  linked: number;
  unknownNumbers: string[];
  unmatchedHeaders: string[];
  matchedByOrder: boolean;
};

export function importSurveyCsv(data: AppData, csv: string): Result<AppData> & { report?: ImportReport } {
  const parsed = parseSurveyTable(parseCsv(csv), data.questions, data.students);
  if (!parsed.ok) return parsed;
  const responses = keepTeacherMarks(
    data.responses,
    parsed.data.responses.map((response) => ({ ...response, id: createId() })),
  );
  const next = { ...data, responses };
  return {
    ok: true,
    data: { ...next, levelEstimates: aggregateLevels(next, responses) },
    report: {
      linked: responses.filter((response) => response.studentId).length,
      unknownNumbers: parsed.data.unknownNumbers,
      unmatchedHeaders: parsed.data.unmatchedHeaders,
      matchedByOrder: parsed.data.matchedByOrder,
    },
  };
}

export function setAnswerMark(data: AppData, responseId: string, questionId: string, teacherScore: SurveyAnswer["teacherScore"], note?: string): AppData {
  const responses = data.responses.map((response) => {
    if (response.id !== responseId) return response;
    return {
      ...response,
      answers: response.answers.map((answer) => {
        if (answer.questionId !== questionId) return answer;
        return { ...answer, teacherScore, note: note ?? answer.note };
      }),
    };
  });
  const next = { ...data, responses };
  return { ...next, levelEstimates: aggregateLevels(next, responses) };
}

export function setLevelChoice(data: AppData, estimateId: string, teacherLevel: string): AppData {
  return {
    ...data,
    levelEstimates: data.levelEstimates.map((item) => (item.id === estimateId ? { ...item, teacherLevel } : item)),
  };
}

export function shownLevel(estimate: LevelEstimate): string {
  return estimate.teacherLevel || estimate.suggestedLevel;
}
