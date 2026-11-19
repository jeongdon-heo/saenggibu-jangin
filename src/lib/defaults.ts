import type { AiSettings, AppData, ClassInfo, Subject } from "../types";
import { createId } from "./id";

export function defaultAiSettings(): AiSettings {
  return { provider: "gemini", model: "gemini-2.5-flash", rememberKey: false };
}

export function emptySubject(id: string, name: string): Subject {
  return { id, name, plan: [], standards: [], units: [], elements: [] };
}

export function emptyData(): AppData {
  return {
    version: 2,
    classInfo: {
      schoolYear: 2026,
      semester: 2,
      grade: null,
      classLabel: "",
    },
    students: [],
    subjects: [],
    records: [],
    questions: [],
    aiSettings: defaultAiSettings(),
  };
}

export function createDemoData(current?: ClassInfo): AppData {
  const classInfo: ClassInfo =
    current?.grade && current.classLabel.trim()
      ? current
      : {
          schoolYear: current?.schoolYear ?? 2026,
          semester: current?.semester ?? 2,
          grade: 4,
          classLabel: "1",
        };
  const students = [
    { id: createId(), number: 1, alias: "ㄱㄴ", realName: "" },
    { id: createId(), number: 2, alias: "ㄷㄹ", realName: "" },
    { id: createId(), number: 3, alias: "ㅁㅂ", realName: "" },
  ];
  const subjectId = createId();
  const standardId = createId();
  const unitId = createId();
  const first = students[0];
  if (!first) return emptyData();

  return {
    version: 2,
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
            method: "수행평가",
            ratio: "30%",
            note: "",
          },
        ],
        standards: [
          {
            id: standardId,
            code: "4국02-01",
            text: "(예시) 성취기준 내용을 학교 교육과정에서 붙여 넣으세요.",
          },
        ],
        units: [
          {
            id: unitId,
            order: 1,
            grade: 4,
            semester: 2,
            organization: "국어",
            title: "(예시) 2. 이야기를 간추려요",
            content: "(예시) 이야기의 중심 내용을 간추린다.",
            pages: "42",
            extraPages: "",
            period: "3",
            totalPeriods: "4",
            materials: "",
          },
        ],
        elements: [
          {
            id: createId(),
            name: "(예시) 중심 내용 파악",
            unitId,
            standardCodes: ["4국02-01"],
            levels: [
              { id: createId(), label: "잘함", description: "(예시) 중심 내용을 자신의 말로 설명한다." },
              { id: createId(), label: "보통", description: "(예시) 중심 내용의 일부를 말한다." },
              { id: createId(), label: "노력요함", description: "(예시) 중심 내용을 찾기 어려워한다." },
            ],
            note: "",
          },
        ],
      },
    ],
    questions: [],
    aiSettings: defaultAiSettings(),
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
