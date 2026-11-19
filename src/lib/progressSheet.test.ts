import { describe, expect, it } from "vitest";
import { parseProgressTable } from "./progressSheet";
import { buildTableXlsx, readXlsxTable } from "./xlsxRead";

const header = ["순번", "*학년", "*학기", "*편제", "단원", "학습내용", "쪽수", "보조쪽수", "해당차시", "전체차시", "준비물"];

describe("나이스 진도표", () => {
  it("별표가 있는 머리글을 읽고 단원 목록을 만든다", () => {
    const result = parseProgressTable([
      ["2026학년도 진도표"],
      header,
      ["1", "4", "2", "국어", "2. 이야기를 간추려요", "중심 내용을 간추린다", "42", "43", "3", "4", "공책"],
      ["2", "4", "2", "수학", "1. 분수", "분수의 크기를 비교한다", "12", "", "1", "6", ""],
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({
      order: 1,
      grade: 4,
      semester: 2,
      organization: "국어",
      title: "2. 이야기를 간추려요",
      content: "중심 내용을 간추린다",
      pages: "42",
      extraPages: "43",
      period: "3",
      totalPeriods: "4",
      materials: "공책",
    });
    expect(result.data[1]?.organization).toBe("수학");
  });

  it("단원 열이 없으면 거절한다", () => {
    const result = parseProgressTable([["이름", "내용"], ["가", "나"]]);
    expect(result.ok).toBe(false);
  });

  it("xlsx로 저장한 진도표를 다시 읽는다", () => {
    const bytes = buildTableXlsx([header, ["1", "4", "2", "국어", "2. 이야기", "간추리기", "42", "", "1", "4", ""]]);
    const table = readXlsxTable(bytes);
    expect(table.ok).toBe(true);
    if (!table.ok) return;
    const parsed = parseProgressTable(table.data);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data[0]?.title).toBe("2. 이야기");
    expect(parsed.data[0]?.grade).toBe(4);
  });
});
