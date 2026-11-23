import { describe, expect, it } from "vitest";
import { addParsedQuestions, promptForElements, updateQuestion } from "./curriculum";
import { emptyData } from "./defaults";
import { addStudent, addSubject } from "./model";
import { importSurveyCsv } from "./survey";
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

  it("question, text, stem, choices, answer 키로 본문을 채운다", () => {
    const result = parseQuestionPaste(
      JSON.stringify({
        questions: [
          { question: "민주주의를 고르세요", type: "choice", choices: ["자치", "혼잣말"], answer: "자치" },
          { text: "까닭을 쓰세요", type: "short", answer: "참여" },
          { stem: "느낌을 말하세요", type: "essay" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((item) => item.prompt)).toEqual(["민주주의를 고르세요", "까닭을 쓰세요", "느낌을 말하세요"]);
    expect(result.data[0]?.choices).toEqual(["자치", "혼잣말"]);
    expect(result.data[0]?.answer).toBe("자치");
  });

  it("고른 사회 평가요소에 붙이고 확정하면 설문으로 넘어간다", () => {
    const created = addSubject(emptyData(), "사회");
    expect(created.ok).toBe(true);
    if (!created.ok || !created.id) return;
    const data = created.data;
    const subject = data.subjects[0];
    if (!subject) return;
    subject.standards = [{ id: "st", code: "4사03-01", text: "자치를 이해한다." }];
    subject.elements = [{ id: "e1", name: "주민 자치", unitId: "u1", standardCodes: ["4사03-01"], levels: [{ id: "l1", label: "상", description: "설명한다." }], note: "" }];
    subject.units = [{ id: "u1", order: 1, grade: 4, semester: 2, organization: "", title: "1. 민주주의와 자치", content: "자치", pages: "", extraPages: "", period: "", totalPeriods: "", materials: "", skipped: false, elementId: "e1", chosenPages: "" }];
    const prompt = promptForElements(data, created.id, ["e1"], [{ type: "choice", count: 1 }]);
    expect(prompt.ok).toBe(true);
    if (!prompt.ok) return;
    expect(prompt.data).toContain("사회");
    expect(prompt.data).toContain("1. 민주주의와 자치");
    expect(prompt.data).toContain("주민 자치");
    expect(prompt.data.startsWith("4학년") || prompt.data.includes("학기 사회")).toBe(true);
    expect(prompt.data).not.toContain("학기 국어");
    const parsed = parseQuestionPaste(JSON.stringify({ questions: [{ question: "자치를 고르세요", type: "choice", choices: ["참여", "포기"], answer: "참여" }] }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const added = addParsedQuestions(data, created.id, parsed.data, "e1");
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.data.questions[0]).toMatchObject({ prompt: "자치를 고르세요", elementId: "e1", elementName: "주민 자치", standardCodes: ["4사03-01"], subjectId: created.id, approved: false, selected: false });
    const confirmed = updateQuestion(added.data, added.data.questions[0]!.id, { approved: true });
    expect(confirmed.questions[0]).toMatchObject({ approved: true, selected: true });
    const enrolled = addStudent(confirmed, { number: 1, alias: "가" });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) return;
    const survey = importSurveyCsv(enrolled.data, "번호,자치를 고르세요\n1,참여");
    expect(survey.ok).toBe(true);
    if (!survey.ok) return;
    expect(survey.report?.matchedByOrder).toBe(false);
    expect(survey.report?.unmatchedHeaders).toEqual([]);
    expect(survey.data.responses[0]?.answers[0]?.questionId).toBe(confirmed.questions[0]?.id);
  });
});
