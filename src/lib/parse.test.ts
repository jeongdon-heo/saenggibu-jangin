import { describe, expect, it } from "vitest";
import { canonicalCode, parsePlan, parseStandards, parseStudentList } from "./parse";

describe("학생 명단 붙여넣기", () => {
  it("번호와 별칭을 읽는다", () => {
    const result = parseStudentList("1 ㄱㄴ\n2 ㄷㄹ\n3\n");
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { number: 1, alias: "ㄱㄴ", realName: "" },
      { number: 2, alias: "ㄷㄹ", realName: "" },
      { number: 3, alias: "", realName: "" },
    ]);
  });

  it("탭으로 나뉜 별칭과 실명을 구분한다", () => {
    const result = parseStudentList("번호\t별칭\t실명\n1\tㄱㄴ\t김민준");
    expect(result.rows).toEqual([{ number: 1, alias: "ㄱㄴ", realName: "김민준" }]);
  });

  it("번호가 아닌 줄과 중복 번호를 알려 준다", () => {
    const result = parseStudentList("abc\n1 ㄱ\n1 ㄴ");
    expect(result.rows).toEqual([{ number: 1, alias: "ㄱ", realName: "" }]);
    expect(result.errors).toHaveLength(2);
  });
});

describe("성취기준 붙여넣기", () => {
  it("대괄호가 있거나 없는 코드를 내용과 나눈다", () => {
    const result = parseStandards("[6국01-01] 국어의 소중함을 인식한다.\n6수01-02: 분수를 이해한다.");
    expect(result.unmatched).toEqual([]);
    expect(result.items).toEqual([
      { code: "6국01-01", text: "국어의 소중함을 인식한다." },
      { code: "6수01-02", text: "분수를 이해한다." },
    ]);
  });

  it("한 줄에 코드가 둘이면 둘 다 읽는다", () => {
    const result = parseStandards("[6국01-01] 문장1 [6국01-02] 문장2");
    expect(result.items.map((item) => item.code)).toEqual(["6국01-01", "6국01-02"]);
    expect(result.items[1]?.text).toBe("문장2");
  });

  it("코드가 없는 줄은 따로 돌려준다", () => {
    const result = parseStandards("그냥 문장입니다.");
    expect(result.items).toEqual([]);
    expect(result.unmatched).toEqual(["그냥 문장입니다."]);
  });

  it("코드 형식을 정리한다", () => {
    expect(canonicalCode("［6국01–01］")).toBe("6국01-01");
    expect(canonicalCode("설명")).toBeNull();
  });
});

describe("평가계획 붙여넣기", () => {
  it("표 머리글을 건너뛰고 칸을 나눈다", () => {
    const result = parsePlan("영역\t평가 내용\t방법\t비율\n읽기\t중심 내용\t관찰\t30%");
    expect(result.warnings).toEqual([]);
    expect(result.items).toEqual([
      { area: "읽기", content: "중심 내용", method: "관찰", ratio: "30%", note: "" },
    ]);
  });

  it("한 줄 항목은 평가 내용으로 넣는다", () => {
    const result = parsePlan("1. 감상문 쓰기");
    expect(result.items[0]?.content).toBe("감상문 쓰기");
  });
});
