import { describe, expect, it } from "vitest";
import { emptyData } from "./defaults";
import { importSurveyCsv, matchStudentNumber, parseCsv, scoreObjective, suggestLevel } from "./survey";
import type { Question, Student } from "../types";

const students: Student[] = [
  { id: "s1", number: 1, alias: "ㄱㄴ", realName: "" },
  { id: "s2", number: 2, alias: "ㄷㄹ", realName: "홍길동" },
];

function choice(id: string, prompt: string, answer: string, order = 1): Question {
  return {
    id,
    subjectId: "kor",
    elementId: "e1",
    elementName: "중심 내용",
    standardCodes: ["4국02-01"],
    targetLevel: "잘함",
    type: "choice",
    prompt,
    choices: ["집을 찾았다", "비를 맞았다"],
    answer,
    rubric: "기준",
    approved: true,
    selected: true,
    order,
  };
}

describe("응답 CSV", () => {
  it("따옴표와 쉼표, 줄바꿈이 있는 칸을 읽는다", () => {
    const table = parseCsv('번호,답\n"1","집, 학교"\n"2","첫 줄\n둘째 줄"');
    expect(table.headers).toEqual(["번호", "답"]);
    expect(table.rows[0]).toEqual(["1", "집, 학교"]);
    expect(table.rows[1]?.[1]).toBe("첫 줄\n둘째 줄");
  });

  it("번호를 명단과 연결하고 없는 번호는 따로 남긴다", () => {
    expect(matchStudentNumber("01번", students).student?.id).toBe("s1");
    expect(matchStudentNumber("홍길동", students).student).toBeNull();
    const data = emptyData();
    data.students = students;
    data.subjects = [{ id: "kor", name: "국어", plan: [], standards: [], units: [], elements: [{ id: "e1", name: "중심 내용", unitId: "", standardCodes: [], levels: [{ id: "l1", label: "잘함", description: "" }, { id: "l2", label: "보통", description: "" }, { id: "l3", label: "노력요함", description: "" }], note: "" }] }];
    data.questions = [choice("q1", "중심은 무엇인가요?", "집을 찾았다")];
    const csv = ["타임스탬프,번호,중심은 무엇인가요?", "2026-11-19 9:00,1,집을 찾았다", "2026-11-19 9:01,2,비를 맞았다", "2026-11-19 9:02,99,집을 찾았다"].join("\n");
    const result = importSurveyCsv(data, csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report?.linked).toBe(2);
    expect(result.report?.unknownNumbers).toEqual(["99"]);
    expect(result.data.responses[0]?.studentId).toBe("s1");
    expect(result.data.responses[0]?.answers[0]?.autoScore).toBe("correct");
    expect(result.data.responses[1]?.answers[0]?.autoScore).toBe("incorrect");
    expect(result.data.levelEstimates.find((item) => item.studentId === "s1")?.suggestedLevel).toBe("잘함");
    expect(result.data.levelEstimates.find((item) => item.studentId === "s2")?.suggestedLevel).toBe("노력요함");
    expect(JSON.stringify(result.data.responses)).not.toContain("홍길동");
  });
});

describe("채점과 수준", () => {
  it("객관식과 단답은 자동으로 채점하고 서술은 비워 둔다", () => {
    const picked = choice("q1", "문제", "집을 찾았다");
    expect(scoreObjective(picked, " 집을 찾았다 ")).toBe("correct");
    expect(scoreObjective(picked, "비를 맞았다")).toBe("incorrect");
    expect(scoreObjective(picked, "")).toBe("unscored");
    expect(scoreObjective({ ...picked, type: "short", answer: "집/학교" }, "학교")).toBe("correct");
    expect(scoreObjective({ ...picked, type: "essay" }, "길게 씀")).toBe("unscored");
  });

  it("맞은 비율로 가장 높은 수준, 가운데, 낮은 수준을 고른다", () => {
    const labels = ["잘함", "보통", "노력요함"];
    expect(suggestLevel(labels, 2, 0, 2)).toBe("잘함");
    expect(suggestLevel(labels, 1, 0, 2)).toBe("보통");
    expect(suggestLevel(labels, 0, 0, 2)).toBe("노력요함");
    expect(suggestLevel(["상", "하"], 1, 0, 2)).toBe("하");
    expect(suggestLevel(["상", "하"], 2, 0, 2)).toBe("상");
  });
});
