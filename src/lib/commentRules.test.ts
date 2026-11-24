import { describe, expect, it } from "vitest";
import { buildCommentPrompt } from "./commentPrompt";
import { defaultCommentRules, lengthBand } from "./commentRules";
import { emptyData } from "./defaults";
import type { AppData } from "../types";

function subjectData(grade: number, subject: string): AppData {
  const data = emptyData();
  data.classInfo.grade = grade;
  data.students = [{ id: "s1", number: 1, alias: "ㄱㄴ", realName: "" }];
  data.subjects = [
    {
      id: "sub",
      name: subject,
      plan: [],
      standards: [{ id: "st", code: "4국02-01", text: "중심 내용을 파악한다." }],
      units: [],
      elements: [
        {
          id: "e1",
          name: "중심 내용",
          unitId: "",
          standardCodes: ["4국02-01"],
          levels: [{ id: "l1", label: "잘함", description: "설명한다." }],
          note: "",
        },
      ],
    },
  ];
  data.records = [
    {
      id: "r1",
      studentId: "s1",
      subjectId: "sub",
      notes: "낱말을 찾음",
      draft: "",
      observation: "",
      draftConfirmed: false,
      observationConfirmed: false,
      updatedAt: "",
    },
  ];
  return data;
}

describe("평어 규칙", () => {
  it("학년과 과목에 맞는 글자 수를 고른다", () => {
    const rules = defaultCommentRules();
    expect(lengthBand(rules, 4, "국어")).toEqual({ min: 250, max: 400 });
    expect(lengthBand(rules, 1, "체육")).toEqual({ min: 180, max: 220 });
    expect(lengthBand(rules, 2, "국어")).toEqual({ min: 350, max: 400 });
    expect(lengthBand(rules, 3, "수학")).toEqual({ min: 350, max: 400 });
    expect(lengthBand(rules, 2, "바른 생활")).toEqual({ min: 350, max: 400 });
    expect(lengthBand(rules, 4, "사회")).toEqual({ min: 250, max: 400 });
  });

  it("기본 규칙으로 평어 프롬프트를 만들고 담백한 문체를 유지한다", () => {
    const built = buildCommentPrompt(subjectData(4, "국어"), "sub", ["s1"], "plain", 0, "평어");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const prompt = built.data.prompt;
    expect(prompt).toContain("3~6문장");
    expect(prompt).toContain("앞으로 ~하기를 바람");
    expect(prompt).toContain("~함 60%");
    expect(prompt).toContain("정확하게");
    expect(prompt).toContain("250~400자");
    expect(prompt).toContain("표현함");
    expect(prompt).toContain("교외 수상");
    expect(prompt).toContain("담백하게");
    expect(prompt).not.toContain("입니다체와 해요체는 쓰세요");
    const warm = buildCommentPrompt(subjectData(2, "국어"), "sub", ["s1"], "warm", 0, "평어");
    expect(warm.ok).toBe(true);
    if (!warm.ok) return;
    expect(warm.data.prompt).toContain("따뜻하게");
    expect(warm.data.prompt).toContain("350~400자");
  });

  it("고친 규칙은 복사하는 프롬프트에 들어간다", () => {
    const data = subjectData(4, "사회");
    data.commentRules = {
      ...defaultCommentRules(),
      sentenceMin: 2,
      sentenceMax: 4,
      allowHope: true,
      endings: { ham: 10, eum: 70, can: 10, im: 5, has: 5 },
      highWords: ["또박또박"],
      varyWords: ["꾸준히"],
      lengthMin: 300,
      lengthMax: 320,
      lengths: [],
      extra: "예시는 학교 생활만 씀",
    };
    const built = buildCommentPrompt(data, "sub", ["s1"], "plain", 0, "평어");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.data.prompt).toContain("2~4문장");
    expect(built.data.prompt).toContain("기대를 한 문장 적어도 됩니다");
    expect(built.data.prompt).toContain("~음·ㅁ");
    expect(built.data.prompt).toContain("70%");
    expect(built.data.prompt).toContain("또박또박");
    expect(built.data.prompt).toContain("꾸준히");
    expect(built.data.prompt).toContain("300~320자");
    expect(built.data.prompt).toContain("예시는 학교 생활만 씀");
    expect(built.data.prompt).toContain("담백하게");
  });
});
