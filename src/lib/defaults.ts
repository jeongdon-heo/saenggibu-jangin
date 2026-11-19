import type { AppData, ClassInfo } from "../types";
import { createId } from "./id";

export function emptyData(): AppData {
  return {
    version: 1,
    classInfo: {
      schoolYear: 2026,
      semester: 2,
      grade: null,
      classLabel: "",
    },
    students: [],
    subjects: [],
    records: [],
  };
}

export function createDemoData(current?: ClassInfo): AppData {
  const classInfo: ClassInfo =
    current?.grade && current.classLabel.trim()
      ? current
      : {
          schoolYear: current?.schoolYear ?? 2026,
          semester: current?.semester ?? 2,
          grade: 6,
          classLabel: "1",
        };
  const students = [
    { id: createId(), number: 1, alias: "ㄱㄴ", realName: "" },
    { id: createId(), number: 2, alias: "ㄷㄹ", realName: "" },
    { id: createId(), number: 3, alias: "ㅁㅂ", realName: "" },
  ];
  const subjectId = createId();
  const first = students[0];
  if (!first) return emptyData();

  return {
    version: 1,
    classInfo,
    students,
    subjects: [
      {
        id: subjectId,
        name: "국어",
        plan: [
          {
            id: createId(),
            area: "읽기",
            content: "(예시) 중심 내용 파악",
            method: "관찰",
            ratio: "30%",
            note: "",
          },
        ],
        standards: [
          {
            id: createId(),
            code: "6국01-01",
            text: "(예시) 성취기준 내용을 학교 교육과정에서 붙여 넣으세요.",
          },
        ],
      },
    ],
    records: [
      {
        id: createId(),
        studentId: first.id,
        subjectId,
        notes: "(예시) 모둠에서 모르는 낱말을 스스로 찾아 봄.",
        draft: "(예시) 이야기를 읽고 중심 내용을 친구에게 설명함. 모르는 낱말은 사전에서 찾아 확인함.",
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}
