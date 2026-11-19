import { describe, expect, it } from "vitest";
import { emptyData } from "./defaults";
import { addStudent, applyStudents, deleteStudent, deleteSubject, findRecord, upsertRecord } from "./model";

describe("학급 데이터 수정", () => {
  it("같은 번호는 거절한다", () => {
    const first = addStudent(emptyData(), { number: 1, alias: "ㄱㄴ" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = addStudent(first.data, { number: 1, alias: "ㄷㄹ" });
    expect(second.ok).toBe(false);
  });

  it("학생을 지우면 그 학생의 기록도 지운다", () => {
    const created = addStudent(emptyData(), { number: 2, alias: "ㄷㄹ" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const student = created.data.students[0];
    expect(student).toBeDefined();
    if (!student) return;
    const withSubject = {
      ...created.data,
      subjects: [{ id: "sub", name: "수학", plan: [], standards: [], units: [], elements: [] }],
    };
    const wrote = upsertRecord(withSubject, student.id, "sub", { draft: "문장" });
    const removed = deleteStudent(wrote.data, student.id);
    expect(removed.students).toEqual([]);
    expect(removed.records).toEqual([]);
  });

  it("과목을 지우면 그 과목의 기록도 지운다", () => {
    const data = emptyData();
    data.students = [{ id: "s1", number: 1, alias: "ㄱ", realName: "" }];
    data.subjects = [{ id: "sub", name: "과학", plan: [], standards: [], units: [], elements: [] }];
    const wrote = upsertRecord(data, "s1", "sub", { notes: "관찰" });
    const removed = deleteSubject(wrote.data, "sub");
    expect(removed.subjects).toEqual([]);
    expect(findRecord(removed, "s1", "sub")).toBeUndefined();
  });

  it("같은 학생·과목 문장은 새로 만들지 않고 고친다", () => {
    const data = emptyData();
    data.students = [{ id: "s1", number: 1, alias: "ㄱ", realName: "홍길동" }];
    data.subjects = [{ id: "sub", name: "국어", plan: [], standards: [], units: [], elements: [] }];
    const first = upsertRecord(data, "s1", "sub", { draft: "처음" });
    const second = upsertRecord(first.data, "s1", "sub", { draft: "고침" });
    expect(second.data.records).toHaveLength(1);
    expect(second.data.records[0]?.draft).toBe("고침");
  });

  it("명단을 바꿔도 같은 번호의 기록은 남긴다", () => {
    const data = emptyData();
    data.students = [{ id: "s1", number: 1, alias: "ㄱ", realName: "" }];
    data.subjects = [{ id: "sub", name: "국어", plan: [], standards: [], units: [], elements: [] }];
    const wrote = upsertRecord(data, "s1", "sub", { draft: "남길 문장" });
    const replaced = applyStudents(wrote.data, [{ number: 1, alias: "ㄴ", realName: "" }], "replace");
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) return;
    expect(replaced.data.students[0]?.id).toBe("s1");
    expect(replaced.data.records[0]?.draft).toBe("남길 문장");
  });
});
