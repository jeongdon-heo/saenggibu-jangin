import { describe, expect, it } from "vitest";
import { addUnits } from "./curriculum";
import { emptyData } from "./defaults";
import { markDraft, observationSeed } from "./evidence";
import { buildCommentPrompt } from "./commentPrompt";
import { guardPrompt } from "./guard";
import { parseBackup, serializeBackup } from "./storage";
import { suggestSkip } from "./topics";
import { bulkSetColumn, combinedFor, lessonTopics, levelForComment, setLevelDecision, upsertTeacherCheck } from "./teacherAssess";

function classData() {
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
      units: [
        {
          id: "u2",
          order: 2,
          grade: 4,
          semester: 2,
          organization: "국어",
          title: "학기말 총정리",
          content: "",
          pages: "",
          extraPages: "",
          period: "",
          totalPeriods: "",
          materials: "",
          skipped: false,
          elementId: "e1",
        },
        {
          id: "u1",
          order: 1,
          grade: 4,
          semester: 2,
          organization: "국어",
          title: "2. 이야기를 간추려요",
          content: "중심 내용을 간추린다.",
          pages: "",
          extraPages: "",
          period: "",
          totalPeriods: "",
          materials: "",
          skipped: false,
          elementId: "e1",
        },
      ],
      elements: [
        {
          id: "e1",
          name: "중심 내용 파악",
          unitId: "u1",
          standardCodes: ["4국02-01"],
          levels: [
            { id: "l1", label: "잘함", description: "자신의 말로 설명한다." },
            { id: "l2", label: "보통", description: "" },
            { id: "l3", label: "노력요함", description: "" },
          ],
          note: "",
        },
      ],
    },
  ];
  return data;
}

describe("학습주제", () => {
  it("공개수업과 총정리는 건너뛰고 교과서 순서는 유지한다", () => {
    expect(suggestSkip("◈공개수업")).toBe(true);
    expect(suggestSkip("학기말 총정리")).toBe(true);
    expect(suggestSkip("2. 이야기를 간추려요", "중심 내용을 간추린다.")).toBe(false);
    const added = addUnits(
      emptyData(),
      "missing",
      [],
      "append",
    );
    expect(added.ok).toBe(false);
    const data = classData();
    data.subjects[0]!.units = [];
    const next = addUnits(data, "kor", [
      { order: 2, grade: 4, semester: 2, organization: "국어", title: "◈공개수업", content: "", pages: "", extraPages: "", period: "", totalPeriods: "", materials: "" },
      { order: 1, grade: 4, semester: 2, organization: "국어", title: "이야기를 간추려요", content: "", pages: "", extraPages: "", period: "", totalPeriods: "", materials: "" },
    ], "append");
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const units = next.data.subjects[0]?.units ?? [];
    expect(units.find((unit) => unit.title === "◈공개수업")?.skipped).toBe(true);
    expect(units.find((unit) => unit.title === "이야기를 간추려요")?.skipped).toBe(false);
    const subject = classData().subjects[0]!;
    subject.units = subject.units.map((unit) => (unit.title.includes("총정리") ? { ...unit, skipped: true } : unit));
    expect(lessonTopics(subject).map((unit) => unit.title)).toEqual(["2. 이야기를 간추려요"]);
  });
});

describe("두 방향 수준", () => {
  it("교사 평가를 우선하고 설문과 다르면 표시한 뒤 확정할 수 있다", () => {
    let data = classData();
    data.subjects[0]!.units[0]!.skipped = true;
    data.levelEstimates = [
      { id: "est", studentId: "s1", subjectId: "kor", elementId: "e1", elementName: "중심 내용 파악", suggestedLevel: "잘함", teacherLevel: "", note: "" },
    ];
    data = upsertTeacherCheck(data, "s1", "kor", "u1", { level: "보통", evidences: ["observe"], note: "모둠에서 낱말을 찾아 봄" });
    data = bulkSetColumn(data, "kor", "u1", "잘함");
    expect(data.teacherChecks.filter((check) => check.unitId === "u1").map((check) => check.level).sort()).toEqual(["잘함", "잘함"]);
    data = upsertTeacherCheck(data, "s1", "kor", "u1", { level: "보통", evidences: ["observe", "performance"], note: "모둠에서 낱말을 찾아 봄" });
    const row = combinedFor(data, "kor", "s1").find((item) => item.elementId === "e1");
    expect(row?.surveyLevel).toBe("잘함");
    expect(row?.teacherLevel).toBe("보통");
    expect(row?.suggested).toBe("보통");
    expect(row?.disagree).toBe(true);
    expect(row?.evidences).toEqual(["observe", "performance"]);
    const onlySurvey = combinedFor(classData(), "kor", "s1");
    expect(onlySurvey[0]?.suggested).toBe("");
    data.levelEstimates = [
      { id: "est", studentId: "s1", subjectId: "kor", elementId: "e1", elementName: "중심 내용 파악", suggestedLevel: "잘함", teacherLevel: "", note: "" },
    ];
    const confirmed = setLevelDecision(data, "s1", "kor", "e1", "노력요함", true);
    expect(levelForComment(combinedFor(confirmed, "kor", "s1")[0]!)).toBe("노력요함");
    const cleared = setLevelDecision(confirmed, "s1", "kor", "e1", "", false);
    expect(levelForComment(combinedFor(cleared, "kor", "s1")[0]!)).toBe("보통");
  });

  it("평어 프롬프트에는 두 수준만 넣고 답안과 이름은 넣지 않는다", () => {
    let data = classData();
    data.subjects[0]!.units[0]!.skipped = true;
    data.levelEstimates = [
      { id: "est", studentId: "s1", subjectId: "kor", elementId: "e1", elementName: "중심 내용 파악", suggestedLevel: "잘함", teacherLevel: "", note: "" },
    ];
    data = upsertTeacherCheck(data, "s1", "kor", "u1", { level: "보통", evidences: ["observe"], note: "모둠에서 낱말을 찾아 봄" });
    data.responses = [
      { id: "resp", studentId: "s1", numberText: "1", submittedAt: "", answers: [{ questionId: "q1", raw: "주인공이 집을 찾아요", autoScore: "unscored", teacherScore: "", note: "" }] },
    ];
    data.questions = [
      {
        id: "q1",
        subjectId: "kor",
        elementId: "e1",
        elementName: "중심 내용 파악",
        standardCodes: [],
        targetLevel: "",
        type: "essay",
        prompt: "써 보세요",
        choices: [],
        answer: "",
        rubric: "",
        approved: true,
        selected: true,
        order: 1,
      },
    ];
    const built = buildCommentPrompt(data, "kor", ["s1"], "plain", 120, "평어");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.data.prompt).toContain("교사 평가: 보통");
    expect(built.data.prompt).toContain("학생 설문 수준: 잘함");
    expect(built.data.prompt).toContain("근거: 관찰");
    expect(built.data.prompt).not.toContain("ㄱㄴ");
    expect(built.data.prompt).not.toContain("홍길동");
    expect(built.data.prompt).not.toContain("주인공이 집을 찾아요");
    expect(guardPrompt(built.data.prompt, data).ok).toBe(true);
    const leaked = upsertTeacherCheck(data, "s1", "kor", "u1", { note: "주인공이 집을 찾아요" });
    const unsafe = buildCommentPrompt(leaked, "kor", ["s1"], "plain", 120, "평어");
    expect(unsafe.ok).toBe(true);
    if (!unsafe.ok) return;
    expect(guardPrompt(unsafe.data.prompt, leaked).ok).toBe(false);
  });

  it("관찰 메모가 들어간 문장만 관찰기록이 필요하다고 표시한다", () => {
    let data = classData();
    data.records = [
      {
        id: "r1",
        studentId: "s1",
        subjectId: "kor",
        notes: "모둠에서 낱말을 찾아 봄",
        draft: "중심 내용을 친구에게 설명함. 모둠에서 낱말을 찾아 확인함.",
        observation: "",
        draftConfirmed: false,
        observationConfirmed: false,
        updatedAt: "",
      },
    ];
    data = upsertTeacherCheck(data, "s1", "kor", "u1", { level: "잘함", evidences: ["performance"], note: "수행 과제를 끝까지 마침" });
    const marks = markDraft(data, "s1", "kor", data.records[0]!.draft);
    expect(marks[0]?.needsObservation).toBe(false);
    expect(marks[1]?.needsObservation).toBe(true);
    const softened = markDraft(data, "s1", "kor", "이야기를 읽고 중심 내용을 설명함. 모르는 낱말은 사전에서 찾아 확인함.");
    expect(softened[1]?.needsObservation).toBe(true);
    expect(softened[0]?.needsObservation).toBe(false);
    expect(marks[1]?.kinds).toContain("observe");
    expect(observationSeed(marks)).toContain("낱말");
    const observation = buildCommentPrompt(data, "kor", ["s1"], "plain", 80, "관찰기록");
    expect(observation.ok).toBe(true);
    if (!observation.ok) return;
    expect(observation.data.prompt).toContain("모둠에서 낱말을 찾아 확인함");
    expect(observation.data.prompt).not.toContain("중심 내용을 친구에게 설명함");
  });

  it("교사 평가를 백업에 넣고 지운 뒤에는 받지 않는다", () => {
    const data = upsertTeacherCheck(classData(), "s1", "kor", "u1", { level: "상", evidences: ["paper"], note: "쪽지시험" });
    const parsed = parseBackup(serializeBackup(data));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.teacherChecks[0]).toMatchObject({ studentId: "s1", level: "상", note: "쪽지시험" });
    const dropped = { ...data, subjects: data.subjects.map((subject) => ({ ...subject, units: [] })) };
    const missing = parseBackup(serializeBackup(dropped));
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.data.teacherChecks).toEqual([]);
  });
});
