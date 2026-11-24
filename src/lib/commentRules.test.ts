import { describe, expect, it } from "vitest";
import { buildCommentPrompt } from "./commentPrompt";
import { defaultCommentRules, lengthBand, normalizeCommentRules } from "./commentRules";
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
  it("기본 글자 수를 쓰고 1학년만 짧게 잡는다", () => {
    const rules = defaultCommentRules();
    expect(lengthBand(rules, 4, "국어")).toEqual({ min: 250, max: 400 });
    expect(lengthBand(rules, 2, "국어")).toEqual({ min: 250, max: 400 });
    expect(lengthBand(rules, 1, "체육")).toEqual({ min: 180, max: 220 });
    expect(lengthBand({ ...rules, lengthMin: 300, lengthMax: 320 }, 1, "국어")).toEqual({ min: 300, max: 320 });
  });

  it("예전 규칙에서 글자 수와 추가 규칙만 남긴다", () => {
    const migrated = normalizeCommentRules({
      sentenceMin: 3,
      sentenceMax: 6,
      allowHope: true,
      endings: { ham: 60, eum: 20, can: 10, im: 5, has: 5 },
      varyWords: ["표현함", "이해함"],
      lengths: [{ grade: 2, subject: "국어", min: 350, max: 400 }],
      lengthMin: 260,
      lengthMax: 380,
      extra: "학교 생활만 씀",
      unknown: "무시",
    });
    expect(migrated).toEqual({
      lengthMin: 260,
      lengthMax: 380,
      nounEnding: true,
      concreteLevel: true,
      noHope: false,
      extra: "학교 생활만 씀",
    });
    expect(normalizeCommentRules({ allowHope: false }).noHope).toBe(true);
    expect(normalizeCommentRules(undefined)).toEqual(defaultCommentRules());
  });

  it("기본 규칙으로 짧은 평어 프롬프트를 만든다", () => {
    const built = buildCommentPrompt(subjectData(4, "국어"), "sub", ["s1"], "plain", 0, "평어");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const prompt = built.data.prompt;
    expect(prompt).toContain("250~400자");
    expect(prompt).toContain("명사형 종결");
    expect(prompt).toContain("종결 어미를 고루 섞어");
    expect(prompt).toContain("구체적인 표현");
    expect(prompt).toContain("기대·당부");
    expect(prompt).toContain("담백하게");
    expect(prompt).not.toContain("3~6문장");
    expect(prompt).not.toContain("60%");
    expect(prompt).not.toContain("표현함");
    const first = buildCommentPrompt(subjectData(1, "국어"), "sub", ["s1"], "warm", 0, "평어");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.prompt).toContain("180~220자");
    expect(first.data.prompt).toContain("따뜻하게");
  });

  it("고친 규칙은 복사하는 프롬프트에 들어간다", () => {
    const data = subjectData(4, "사회");
    data.commentRules = {
      lengthMin: 300,
      lengthMax: 320,
      nounEnding: false,
      concreteLevel: true,
      noHope: false,
      extra: "예시는 학교 생활만 씀",
    };
    const built = buildCommentPrompt(data, "sub", ["s1"], "plain", 0, "평어");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.data.prompt).toContain("300~320자");
    expect(built.data.prompt).not.toContain("명사형 종결");
    expect(built.data.prompt).toContain("구체적인 표현");
    expect(built.data.prompt).not.toContain("기대·당부");
    expect(built.data.prompt).toContain("예시는 학교 생활만 씀");
    expect(built.data.prompt).toContain("담백하게");
  });
});
