import type { QuestionTypeId } from "../types";

export const QUESTION_TYPES: Array<{ id: QuestionTypeId; label: string; hint: string }> = [
  { id: "choice", label: "객관식", hint: "보기 중 하나를 고릅니다." },
  { id: "short", label: "단답형", hint: "짧은 답을 적습니다." },
  { id: "essay", label: "서술형", hint: "이유나 과정을 문장으로 씁니다." },
  { id: "check", label: "자기평가 체크", hint: "스스로 점검하는 항목입니다." },
];

export function questionTypeLabel(id: QuestionTypeId): string {
  return QUESTION_TYPES.find((item) => item.id === id)?.label ?? id;
}

const TYPE_WORDS: Array<[QuestionTypeId, string[]]> = [
  ["choice", ["객관식", "choice", "선다", "multiple"]],
  ["short", ["단답형", "단답", "short"]],
  ["essay", ["서술형", "서술", "essay"]],
  ["check", ["자기평가 체크", "자기평가", "체크", "check", "self"]],
];

export function parseQuestionType(value: string, hasChoices: boolean): QuestionTypeId {
  const compact = value.replace(/\s/g, "").toLowerCase();
  for (const [id, words] of TYPE_WORDS) {
    if (words.some((word) => compact.includes(word.replace(/\s/g, "").toLowerCase()))) return id;
  }
  return hasChoices ? "choice" : "short";
}
