import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { appendObservationToDraft, buildExportRows, buildExportTable } from "./exportRows";
import { countChars, countNeisBytes } from "./textCount";
import { buildXlsxBytes } from "./xlsx";
import type { AppData } from "../types";

const data: AppData = {
  version: 3,
  questions: [],
  responses: [],
  levelEstimates: [],
  teacherChecks: [],
  levelDecisions: [],
  aiSettings: { provider: "gemini", model: "gemini-3.8-flash", rememberKey: false },
  classInfo: { schoolYear: 2026, semester: 2, grade: 6, classLabel: "1" },
  students: [
    { id: "s2", number: 2, alias: "ㄷㄹ", realName: "홍길동" },
    { id: "s1", number: 1, alias: "ㄱㄴ", realName: "" },
  ],
  subjects: [
    { id: "kor", name: "국어", plan: [], standards: [], units: [], elements: [] },
    { id: "math", name: "수학", plan: [], standards: [], units: [], elements: [] },
  ],
  records: [
    {
      id: "r1",
      studentId: "s1",
      subjectId: "kor",
      notes: "관찰 메모는 빼야 한다",
      draft: "이야기를 읽음.",
      observation: "",
      draftConfirmed: true,
      observationConfirmed: false,
      updatedAt: "2026-11-19T00:00:00.000Z",
    },
  ],
};

describe("엑셀 행", () => {
  it("번호 순으로 과목별 문장과 글자 수, 바이트를 만든다", () => {
    const rows = buildExportRows(data);
    expect(rows.map((row) => [row.number, row.subject, row.alias])).toEqual([[1, "국어", "ㄱㄴ"]]);
    const first = rows[0];
    expect(first?.draft).toBe("이야기를 읽음.");
    expect(first?.kind).toBe("교과 평어");
    expect(first?.chars).toBe(countChars("이야기를 읽음."));
    expect(first?.bytes).toBe(countNeisBytes("이야기를 읽음."));
    expect(rows).toHaveLength(1);
  });

  it("실명과 관찰 메모는 행에 넣지 않는다", () => {
    const rows = buildExportRows(data);
    const packed = JSON.stringify(rows);
    expect(packed).not.toContain("홍길동");
    expect(packed).not.toContain("관찰 메모는 빼야 한다");
    expect(Object.keys(rows[0] ?? {})).toEqual(["number", "alias", "subject", "kind", "draft", "chars", "bytes"]);
  });

  it("확인한 관찰기록은 교과 평어를 덮지 않고 따로 내보낸다", () => {
    const comment = "이야기를 읽고 중심 내용을 파악하여 친구에게 설명함. 모르는 낱말은 사전에서 찾아 확인함.";
    const observation = "모둠에서 모르는 낱말을 스스로 찾아 봄.";
    const stored = {
      ...data,
      records: [
        {
          ...data.records[0]!,
          draft: comment,
          observation,
          draftConfirmed: true,
          observationConfirmed: true,
        },
      ],
    };
    const rows = buildExportRows(stored);
    expect(rows.map((row) => [row.kind, row.draft])).toEqual([
      ["교과 평어", comment],
      ["관찰기록", observation],
    ]);
    expect(rows[0]?.chars).toBe(countChars(comment));
    expect(rows[1]?.chars).toBe(countChars(observation));
    expect(stored.records[0]?.draft).toBe(comment);
    const table = buildExportTable(stored, "columns");
    expect(table[0]).toEqual(["번호", "이니셜", "국어", "국어 관찰기록"]);
    expect(table[1]).toEqual(["1", "ㄱㄴ", comment, observation]);
    expect(appendObservationToDraft(comment, observation)).toBe(`${comment} ${observation}`);
    expect(appendObservationToDraft(`${comment} ${observation}`, observation)).toBe(`${comment} ${observation}`);
  });

  it("엑셀 파일에 머리글과 문장을 넣고 실명은 넣지 않는다", () => {
    const bytes = buildXlsxBytes(buildExportRows(data));
    const files = unzipSync(bytes);
    const shared = strFromU8(files["xl/sharedStrings.xml"] ?? new Uint8Array());
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"] ?? new Uint8Array());
    expect(shared).toContain("성취수준 및 특기사항");
    expect(shared).toContain("이야기를 읽음.");
    expect(shared).not.toContain("홍길동");
    expect(shared).not.toContain("관찰 메모는 빼야 한다");
    expect(sheet).toContain('t="s"');
  });
});
