import { describe, expect, it } from "vitest";
import { parseQuestionPaste } from "./questionParse";

const korean = `
설명은 무시합니다.
\`\`\`json
{
  "questions": [
    {
      "평가요소": "중심 내용 파악",
      "성취기준": ["4국02-01"],
      "목표수준": "잘함",
      "유형": "객관식",
      "문제": "이 이야기의 중심 내용은 무엇인가요?",
      "보기": ["친구와 놀았다", "집을 찾았다", "비를 맞았다", "노래를 불렀다"],
      "정답": "집을 찾았다",
      "채점기준": "중심 내용을 고르면 잘함"
    }
  ]
}
\`\`\`
`;

describe("문제 붙여넣기", () => {
  it("코드 블록 안의 한국어 JSON을 문제로 읽는다", () => {
    const result = parseQuestionPaste(korean);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({
      element: "중심 내용 파악",
      standardCodes: ["4국02-01"],
      targetLevel: "잘함",
      type: "choice",
      prompt: "이 이야기의 중심 내용은 무엇인가요?",
      answer: "집을 찾았다",
      rubric: "중심 내용을 고르면 잘함",
    });
    expect(result.data[0]?.choices).toHaveLength(4);
  });

  it("영어 키와 서술형도 읽는다", () => {
    const result = parseQuestionPaste(
      JSON.stringify({
        questions: [{ element: "요약", type: "essay", prompt: "줄거리를 써 보세요", sampleAnswer: "예시", rubric: "기준" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]?.type).toBe("essay");
    expect(result.data[0]?.answer).toBe("예시");
  });

  it("형식이 아니면 이유를 알린다", () => {
    expect(parseQuestionPaste("그냥 문장").ok).toBe(false);
    expect(parseQuestionPaste("").ok).toBe(false);
  });
});
