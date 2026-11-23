import type { QuestionTypeId } from "../types";
import { questionTypeLabel } from "./questionTypes";

export type PromptLevel = { label: string; description: string };

export type PromptItem = {
  element: string;
  unitTitle: string;
  unitContent: string;
  standards: Array<{ code: string; text: string }>;
  levels: PromptLevel[];
};

export type PromptContext = {
  grade: number | null;
  semester: 1 | 2;
  subject: string;
  items: PromptItem[];
  counts: Array<{ type: QuestionTypeId; count: number }>;
};

export function buildQuestionPrompt(context: PromptContext): string {
  const grade = context.grade ? `${context.grade}학년` : "초등학교";
  const lines: string[] = [
    `${grade} ${context.semester}학기 ${context.subject} 수업에서, 성취수준을 가늠할 문제를 만들어 주세요.`,
    "학생 이름, 번호, 별칭, 관찰 메모, 생활기록 문장은 주지 않았습니다. 지어 넣지 마세요.",
    "각 문제는 학교의 수준 라벨 가운데 하나를 목표수준으로 달고, 그 수준과 바로 옆 수준을 구분할 수 있어야 합니다.",
    "성취기준 코드 밖 내용으로 넓히지 마세요.",
    "초등학생이 읽을 수 있는 말로 쓰세요.",
    "",
    "만들 개수",
  ];
  for (const item of context.counts) {
    if (item.count > 0) lines.push(`- ${questionTypeLabel(item.type)} ${item.count}개`);
  }
  lines.push("", "평가요소");
  for (const item of context.items) {
    lines.push(`- 평가요소: ${item.element}`);
    if (item.unitTitle) lines.push(`  단원: ${item.unitTitle}`);
    if (item.unitContent) lines.push(`  학습내용: ${item.unitContent}`);
    if (item.standards.length === 0) lines.push("  성취기준: 없음");
    for (const standard of item.standards) {
      lines.push(`  성취기준: [${standard.code}] ${standard.text}`.trim());
    }
    if (item.levels.length === 0) lines.push("  수준별 기준: 없음. 상/중/하로 나누되 목표수준에 그 라벨을 적으세요.");
    for (const level of item.levels) {
      lines.push(`  수준 ${level.label}: ${level.description}`);
    }
  }
  lines.push(
    "",
    "아래 JSON만 출력하세요. 설명 문장은 붙이지 마세요.",
    "{",
    '  "questions": [',
    "    {",
    '      "평가요소": "위 평가요소 이름",',
    '      "성취기준": ["코드"],',
    '      "목표수준": "학교 수준 라벨",',
    '      "유형": "객관식 | 단답형 | 서술형 | 자기평가 체크",',
    '      "문제": "문제 본문",',
    '      "보기": ["객관식이나 체크 항목. 없으면 빈 배열"],',
    '      "정답": "정답 또는 예시 답안",',
    '      "채점기준": "무엇을 보면 그 수준인지"',
    "    }",
    "  ]",
    "}",
    "영어 키 question, text, stem, prompt, choices, options, answer, type도 같은 자리에 쓸 수 있습니다.",
    "평가요소를 빠뜨리면 앱에서 지금 고른 평가요소로 붙입니다.",
  );
  return lines.join("\n");
}
