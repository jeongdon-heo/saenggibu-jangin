import { describe, expect, it } from "vitest";
import { applyGeneratedText } from "./commentApply";
import { checkComment, findNearDuplicates, textSimilarity } from "./commentCheck";
import { parseCommentPaste } from "./commentParse";
import { anonymizeStudents, buildCommentPrompt } from "./commentPrompt";
import { emptyData } from "./defaults";
import { buildExportTable } from "./exportRows";
import { guardPrompt } from "./guard";
import { countChars, countNeisBytes } from "./textCount";

describe("익명 자리표시", () => {
  it("번호 순으로 학생A, 학생B를 매기고 프롬프트에는 신원과 답안을 넣지 않는다", () => {
    const data = emptyData();
    data.classInfo.grade = 4;
    data.students = [
      { id: "s2", number: 2, alias: "ㄷㄹ", realName: "홍길동" },
      { id: "s1", number: 1, alias: "ㄱㄴ", realName: "" },
    ];
    data.subjects = [
      {
        id: "kor",
        name: "국어",
        plan: [],
        standards: [{ id: "st", code: "4국02-01", text: "중심 내용을 파악한다." }],
        units: [],
        elements: [
          {
            id: "e1",
            name: "중심 내용 파악",
            unitId: "",
            standardCodes: ["4국02-01"],
            levels: [{ id: "l1", label: "잘함", description: "자신의 말로 설명한다." }],
            note: "",
          },
        ],
      },
    ];
    data.levelEstimates = [
      { id: "est", studentId: "s1", subjectId: "kor", elementId: "e1", elementName: "중심 내용 파악", suggestedLevel: "잘함", teacherLevel: "", note: "" },
    ];
    data.records = [
      {
        id: "r1",
        studentId: "s1",
        subjectId: "kor",
        notes: "낱말을 스스로 찾음",
        draft: "",
        observation: "",
        draftConfirmed: false,
        observationConfirmed: false,
        updatedAt: "",
      },
    ];
    data.responses = [
      {
        id: "resp",
        studentId: "s1",
        numberText: "1",
        submittedAt: "",
        answers: [{ questionId: "q", raw: "주인공이 집을 찾아요", autoScore: "unscored", teacherScore: "", note: "" }],
      },
    ];
    const links = anonymizeStudents(data.students);
    expect(links.map((link) => link.token)).toEqual(["학생A", "학생B"]);
    expect(links[0]?.studentId).toBe("s1");
    const built = buildCommentPrompt(data, "kor", ["s1"], "plain", 120, "평어");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.data.prompt).toContain("학생A");
    expect(built.data.prompt).toContain("잘함");
    expect(built.data.prompt).toContain("낱말을 스스로 찾음");
    expect(built.data.prompt).toContain("[4국02-01]");
    expect(built.data.prompt).not.toContain("ㄱㄴ");
    expect(built.data.prompt).not.toContain("홍길동");
    expect(built.data.prompt).not.toContain("1번");
    expect(built.data.prompt).not.toContain("주인공이 집을 찾아요");
    expect(guardPrompt(built.data.prompt, data).ok).toBe(true);
    const parsed = parseCommentPaste('{"records":[{"학생":"학생A","평어":"이야기를 읽고 중심 내용을 설명함."}]}', "평어");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const applied = applyGeneratedText(data, "kor", parsed.data, "draft");
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.data.records.find((record) => record.studentId === "s1")?.draft).toContain("설명함");
  });
});

describe("문장 검사와 유사도", () => {
  it("금지 내용, 문체, 과장, 답안 인용, 성취기준 복사를 짚는다", () => {
    const flags = checkComment("대회에서 대상을 받아 매우 훌륭합니다. 중심 내용을 파악한다. 주인공이 집을 찾아요", {
      answers: ["주인공이 집을 찾아요"],
      standardTexts: ["중심 내용을 파악한다."],
    });
    expect(flags.map((flag) => flag.code)).toEqual(expect.arrayContaining(["banned", "loud", "style", "answer", "standard"]));
  });

  it("비슷한 문장은 겹침으로 보고 다른 문장은 넘어간다", () => {
    const near = textSimilarity("이야기를 읽고 중심 내용을 설명함. 낱말을 사전에서 찾음.", "이야기를 읽고 중심 내용을 설명함. 낱말을 사전에서 확인함.");
    expect(near).toBeGreaterThan(0.72);
    const hits = findNearDuplicates([
      { id: "a", text: "이야기를 읽고 중심 내용을 설명함. 낱말을 사전에서 찾음." },
      { id: "b", text: "이야기를 읽고 중심 내용을 설명함. 낱말을 사전에서 확인함." },
      { id: "c", text: "음악 시간에 장단을 맞춰 노래함." },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ a: "a", b: "b" });
  });
});

describe("확인한 문장만 내보내기", () => {
  it("확인 전 문장은 빼고 번호 순의 행과 과목 열을 만든다", () => {
    const data = emptyData();
    data.students = [
      { id: "s2", number: 2, alias: "ㄷㄹ", realName: "" },
      { id: "s1", number: 1, alias: "ㄱㄴ", realName: "" },
    ];
    data.subjects = [
      { id: "kor", name: "국어", plan: [], standards: [], units: [], elements: [] },
      { id: "math", name: "수학", plan: [], standards: [], units: [], elements: [] },
    ];
    data.records = [
      { id: "r1", studentId: "s1", subjectId: "kor", notes: "", draft: "국어 문장임.", observation: "국어 관찰임.", draftConfirmed: true, observationConfirmed: true, updatedAt: "" },
      { id: "r2", studentId: "s2", subjectId: "kor", notes: "", draft: "아직 초안임.", observation: "", draftConfirmed: false, observationConfirmed: false, updatedAt: "" },
      { id: "r3", studentId: "s2", subjectId: "math", notes: "", draft: "수학 문장임.", observation: "", draftConfirmed: true, observationConfirmed: false, updatedAt: "" },
    ];
    expect(buildExportTable(data, "rows")).toEqual([
      ["번호", "이니셜", "과목", "구분", "성취수준 및 특기사항", "글자수", "바이트"],
      ["1", "ㄱㄴ", "국어", "교과 평어", "국어 문장임.", String(countChars("국어 문장임.")), String(countNeisBytes("국어 문장임."))],
      ["1", "ㄱㄴ", "국어", "관찰기록", "국어 관찰임.", String(countChars("국어 관찰임.")), String(countNeisBytes("국어 관찰임."))],
      ["2", "ㄷㄹ", "수학", "교과 평어", "수학 문장임.", String(countChars("수학 문장임.")), String(countNeisBytes("수학 문장임."))],
    ]);
    expect(buildExportTable(data, "columns")[0]).toEqual(["번호", "이니셜", "국어", "국어 관찰기록", "수학"]);
    expect(buildExportTable(data, "columns")[1]).toEqual(["1", "ㄱㄴ", "국어 문장임.", "국어 관찰임.", ""]);
    expect(JSON.stringify(buildExportTable(data, "rows"))).not.toContain("아직 초안임");
  });
});
