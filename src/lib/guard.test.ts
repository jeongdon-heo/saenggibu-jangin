import { describe, expect, it } from "vitest";
import { emptyData } from "./defaults";
import { findRosterLeaks, guardPrompt } from "./guard";
import { buildQuestionPrompt, type PromptContext } from "./prompt";
import type { AppData } from "../types";

function classData(): AppData {
  const data = emptyData();
  data.classInfo = { schoolYear: 2026, semester: 2, grade: 4, classLabel: "1" };
  data.students = [
    { id: "s1", number: 1, alias: "ㄱㄴ", realName: "홍길동" },
    { id: "s2", number: 11, alias: "ㄷㄹ", realName: "" },
  ];
  data.records = [
    {
      id: "r1",
      studentId: "s1",
      subjectId: "sub",
      notes: "모둠에서 낱말을 찾아 봄",
      draft: "이야기를 읽고 중심 내용을 설명함",
      updatedAt: "",
    },
  ];
  return data;
}

const context: PromptContext = {
  grade: 4,
  semester: 2,
  subject: "국어",
  counts: [{ type: "choice", count: 2 }],
  items: [
    {
      element: "중심 내용 파악",
      unitTitle: "2. 이야기를 간추려요",
      unitContent: "이야기의 중심 내용을 간추린다.",
      standards: [{ code: "4국02-01", text: "중심 내용을 파악한다." }],
      levels: [
        { label: "잘함", description: "자신의 말로 설명한다." },
        { label: "보통", description: "일부를 말한다." },
      ],
    },
  ],
};

describe("프롬프트", () => {
  it("학년, 과목, 단원, 평가요소, 성취기준, 수준만 담는다", () => {
    const prompt = buildQuestionPrompt(context);
    expect(prompt).toContain("4학년");
    expect(prompt).toContain("국어");
    expect(prompt).toContain("중심 내용 파악");
    expect(prompt).toContain("2. 이야기를 간추려요");
    expect(prompt).toContain("[4국02-01]");
    expect(prompt).toContain("잘함");
    expect(prompt).toContain("객관식 2개");
    expect(prompt).toContain('"평가요소"');
    expect(prompt).not.toContain("ㄱㄴ");
    expect(prompt).not.toContain("홍길동");
    expect(prompt).not.toContain("모둠에서");
  });
});

describe("보내기 전 검사", () => {
  it("수업 내용 프롬프트는 통과한다", () => {
    const prompt = buildQuestionPrompt(context);
    expect(guardPrompt(prompt, classData()).ok).toBe(true);
    expect(findRosterLeaks(prompt, classData())).toEqual([]);
  });

  it("별칭, 실명, 번호, 메모, 문장이 있으면 막고 한국어로 알린다", () => {
    const data = classData();
    const prompt = `${buildQuestionPrompt(context)}\n학생 홍길동 1번 별칭 ㄱㄴ\n${data.records[0]?.draft}`;
    const result = guardPrompt(prompt, data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("학생 정보가 섞여 있어 보내지 않았습니다");
    expect(result.error).toContain("홍길동");
    expect(result.error).toContain("ㄱㄴ");
    expect(result.error).toContain("1번");
  });

  it("11번 안의 1번으로 오인하지 않고 4학년은 번호가 아니다", () => {
    const data = classData();
    expect(findRosterLeaks("4학년 11번 문항", data).map((hit) => hit.text)).toEqual(["11번"]);
    expect(findRosterLeaks("4학년 국어", data)).toEqual([]);
  });
});
