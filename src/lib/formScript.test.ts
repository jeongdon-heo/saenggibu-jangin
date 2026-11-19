import { describe, expect, it } from "vitest";
import { buildFormPreview, buildFormScript, selectedQuestions, studentFormText } from "./formScript";
import type { Question } from "../types";

const info = { schoolYear: 2026, semester: 2 as const, grade: 4, classLabel: "1" };

function question(patch: Partial<Question>): Question {
  return {
    id: "q1",
    subjectId: "kor",
    elementId: "e1",
    elementName: "중심 내용",
    standardCodes: ["4국02-01"],
    targetLevel: "잘함",
    type: "choice",
    prompt: "중심은 무엇인가요?",
    choices: ["집을 찾았다", "비를 맞았다"],
    answer: "비밀정답",
    rubric: "비밀채점기준",
    approved: true,
    selected: true,
    order: 1,
    ...patch,
  };
}

describe("구글 폼 스크립트", () => {
  it("3단계에서 고른 문제만 넣고 정답과 채점 기준은 빼며 번호만 묻는다", () => {
    const questions = [
      question({}),
      question({ id: "q2", type: "essay", prompt: "자신의 말로 써 보세요.", choices: [], order: 2 }),
      question({ id: "q3", prompt: "넣지 않을 문제", selected: false, order: 3 }),
      question({ id: "q4", prompt: "확정 전 문제", approved: false, order: 4 }),
    ];
    expect(selectedQuestions(questions).map((item) => item.id)).toEqual(["q1", "q2"]);
    const preview = buildFormPreview(info, "국어", selectedQuestions(questions));
    const script = buildFormScript(preview);
    expect(preview.items).toHaveLength(2);
    expect(script).toContain("numberItem.setTitle('번호')");
    expect(script).toContain("이름은 적지 마세요");
    expect(script).toContain("중심은 무엇인가요?");
    expect(script).toContain("집을 찾았다");
    expect(script).toContain("addParagraphTextItem");
    expect(script).toContain("setIsQuiz(false)");
    expect(script).not.toContain("비밀정답");
    expect(script).not.toContain("비밀채점기준");
    expect(script).not.toContain("잘함");
    expect(script).not.toContain("넣지 않을 문제");
    expect(studentFormText(preview)).not.toContain("비밀정답");
    expect(studentFormText(preview)).toContain("번호 (필수)");
  });

  it("따옴표와 줄바꿈을 스크립트 문자열로 이스케이프한다", () => {
    const preview = buildFormPreview(info, "국어", [question({ prompt: "그는 '집'을\n찾았나요?", choices: ["a's"] })]);
    const script = buildFormScript(preview);
    expect(script).toContain("\\'");
    expect(script).toContain("\\n");
    expect(script).not.toContain("\n찾았나요");
  });
});
