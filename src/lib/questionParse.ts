import type { QuestionTypeId, Result } from "../types";
import { parseQuestionType } from "./questionTypes";

export type ParsedQuestion = {
  element: string;
  standardCodes: string[];
  targetLevel: string;
  type: QuestionTypeId;
  prompt: string;
  choices: string[];
  answer: string;
  rubric: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textOf).map((item) => item.trim()).filter(Boolean);
  const one = textOf(value);
  if (!one) return [];
  return one
    .split(/[,،]\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function field(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced?.[1] ?? raw).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) {
    const arrayStart = source.indexOf("[");
    const arrayEnd = source.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(source.slice(arrayStart, arrayEnd + 1));
    return JSON.parse(source);
  }
  return JSON.parse(source.slice(start, end + 1));
}

function oneQuestion(value: unknown): ParsedQuestion | null {
  if (!isRecord(value)) return null;
  const choices = stringList(field(value, ["보기", "choices", "options", "항목"]));
  const prompt = textOf(field(value, ["문제", "prompt", "question", "문항"]));
  if (!prompt) return null;
  const type = parseQuestionType(textOf(field(value, ["유형", "type", "kind"])), choices.length > 0);
  return {
    element: textOf(field(value, ["평가요소", "element", "elementName"])),
    standardCodes: stringList(field(value, ["성취기준", "standardCodes", "standards", "codes"])),
    targetLevel: textOf(field(value, ["목표수준", "targetLevel", "수준", "level"])),
    type,
    prompt,
    choices,
    answer: textOf(field(value, ["정답", "answer", "예시답안", "sampleAnswer"])),
    rubric: textOf(field(value, ["채점기준", "채점 기준", "rubric"])),
  };
}

export function parseQuestionPaste(raw: string): Result<ParsedQuestion[]> {
  if (!raw.trim()) return { ok: false, error: "붙여넣은 내용이 비어 있습니다." };
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ok: false, error: "문제 JSON을 읽지 못했습니다. 중괄호로 된 형식인지 확인해 주세요." };
  }
  const list = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.questions ?? parsed["문제들"] : null;
  if (!Array.isArray(list)) return { ok: false, error: "questions 배열을 찾지 못했습니다." };
  const questions = list.map(oneQuestion).filter((item): item is ParsedQuestion => item !== null);
  if (questions.length === 0) return { ok: false, error: "문제 본문이 있는 항목을 찾지 못했습니다." };
  return { ok: true, data: questions };
}
