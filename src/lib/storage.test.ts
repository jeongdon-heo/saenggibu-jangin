import { describe, expect, it } from "vitest";
import { emptyData } from "./defaults";
import {
  createMemoryStorage,
  loadFrom,
  parseBackup,
  saveTo,
  serializeBackup,
  STORAGE_KEY,
} from "./storage";
import type { AppData } from "../types";

function sample(): AppData {
  return {
    version: 3,
    classInfo: { schoolYear: 2026, semester: 2, grade: 6, classLabel: "1" },
    students: [{ id: "s1", number: 1, alias: "ㄱㄴ", realName: "" }],
    subjects: [
      {
        id: "sub",
        name: "국어",
        plan: [{ id: "p1", area: "읽기", content: "중심 내용", method: "관찰", ratio: "30%", note: "" }],
        standards: [{ id: "st1", code: "6국01-01", text: "성취기준 내용" }],
        units: [],
        elements: [],
      },
    ],
    questions: [],
    responses: [],
    levelEstimates: [],
    teacherChecks: [],
    levelDecisions: [],
    aiSettings: { provider: "gemini", model: "gemini-2.5-flash", rememberKey: false },
    records: [
      {
        id: "r1",
        studentId: "s1",
        subjectId: "sub",
        notes: "메모\n둘째 줄",
        draft: "가 나\r\n다",
        observation: "",
        draftConfirmed: false,
        observationConfirmed: false,
        updatedAt: "2026-11-19T00:00:00.000Z",
      },
    ],
  };
}

describe("백업 저장과 불러오기", () => {
  it("한글, 줄바꿈, 비어 있는 실명을 그대로 왕복한다", () => {
    const storage = createMemoryStorage();
    const data = sample();
    expect(saveTo(storage, data).ok).toBe(true);
    const loaded = loadFrom(storage);
    expect(loaded.persist).toBe(true);
    expect(loaded.warning).toBeNull();
    expect(loaded.data).toEqual(data);

    const imported = parseBackup(serializeBackup(data, "2026-11-19T01:00:00.000Z"));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.data.students[0]?.realName).toBe("");
      expect(imported.data.records[0]?.notes).toBe("메모\n둘째 줄");
      expect(imported.data.records[0]?.draft).toBe("가 나\r\n다");
    }
  });

  it("감싼 백업 파일과 데이터만 있는 파일을 모두 받는다", () => {
    const data = sample();
    const wrapped = parseBackup(serializeBackup(data));
    const raw = parseBackup(JSON.stringify(data));
    expect(wrapped.ok).toBe(true);
    expect(raw.ok).toBe(true);
    if (wrapped.ok && raw.ok) {
      expect(wrapped.data).toEqual(data);
      expect(raw.data).toEqual(data);
    }
  });

  it("실명 항목이 없어도 학생을 받는다", () => {
    const raw = {
      version: 1,
      classInfo: { schoolYear: 2026, semester: 1, grade: 3, classLabel: "2" },
      students: [{ id: "s1", number: 1, alias: "별" }],
      subjects: [],
      records: [],
    };
    const result = parseBackup(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.students[0]).toEqual({ id: "s1", number: 1, alias: "별", realName: "" });
      expect(result.data.version).toBe(3);
      expect(result.data.questions).toEqual([]);
    }
  });

  it("예전 백업에 없던 단원과 문제는 빈 목록으로 열고 API 키는 남기지 않는다", () => {
    const raw = {
      version: 1,
      apiKey: "sk-secret",
      classInfo: { schoolYear: 2026, semester: 2, grade: 4, classLabel: "1" },
      students: [],
      subjects: [{ id: "sub", name: "국어", plan: [], standards: [] }],
      records: [],
    };
    const result = parseBackup(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.subjects[0]?.units).toEqual([]);
    expect(result.data.subjects[0]?.elements).toEqual([]);
    expect(result.data.questions).toEqual([]);
    expect(result.data.responses).toEqual([]);
    expect(JSON.stringify(result.data)).not.toContain("sk-secret");
  });

  it("백업 파일이 아니면 거절한다", () => {
    expect(parseBackup("[]").ok).toBe(false);
    expect(parseBackup("{}").ok).toBe(false);
    expect(parseBackup("not json").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ version: 9, students: [] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "other", data: {} })).ok).toBe(false);
  });

  it("번호가 겹치면 거절한다", () => {
    const data = sample();
    data.students.push({ id: "s2", number: 1, alias: "ㄷㄹ", realName: "" });
    const result = parseBackup(JSON.stringify(data));
    expect(result.ok).toBe(false);
  });

  it("저장이 실패하면 성공으로 보고하지 않는다", () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw new Error("quota");
    };
    const result = saveTo(storage, emptyData());
    expect(result.ok).toBe(false);
  });

  it("비어 있는 저장소는 빈 학급으로 연다", () => {
    const loaded = loadFrom(createMemoryStorage());
    expect(loaded.data).toEqual(emptyData());
    expect(loaded.persist).toBe(true);
    expect(loaded.rawBackup).toBeNull();
  });

  it("읽지 못한 저장은 덮어쓰지 않도록 표시하고 원문을 남긴다", () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: "{broken" });
    const loaded = loadFrom(storage);
    expect(loaded.persist).toBe(false);
    expect(loaded.rawBackup).toBe("{broken");
    expect(loaded.warning).toContain("읽지 못했습니다");
    expect(loaded.data.students).toEqual([]);
  });

  it("빈 데이터로 다시 저장하면 학생 명단이 사라진다", () => {
    const storage = createMemoryStorage();
    const data = sample();
    saveTo(storage, data);
    saveTo(storage, emptyData());
    const loaded = loadFrom(storage);
    expect(loaded.data.students).toEqual([]);
    expect(loaded.data.records).toEqual([]);
  });
});
