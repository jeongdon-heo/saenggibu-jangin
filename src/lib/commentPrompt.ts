import type { AppData, Result } from "../types";
import { findRecord, sortedStudents } from "./model";
import { shownLevel } from "./survey";

export type CommentTone = "plain" | "warm";

export type AnonLink = { token: string; studentId: string };

export function tokenAt(index: number): string {
  let number = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (number % 26)) + label;
    number = Math.floor(number / 26) - 1;
  } while (number >= 0);
  return `학생${label}`;
}

export function anonymizeStudents(students: AppData["students"]): AnonLink[] {
  return sortedStudents(students).map((student, index) => ({ token: tokenAt(index), studentId: student.id }));
}

export type CommentElement = {
  name: string;
  level: string;
  levelDescription: string;
  unitTitle: string;
  standards: Array<{ code: string; text: string }>;
};

export type CommentStudent = {
  token: string;
  memo: string;
  elements: CommentElement[];
};

export type CommentBrief = {
  grade: number | null;
  semester: 1 | 2;
  subject: string;
  tone: CommentTone;
  targetChars: number;
  students: CommentStudent[];
};

const TONE_LINE: Record<CommentTone, string> = {
  plain: "문체는 담백하게 쓰고 꾸미는 말은 줄이세요.",
  warm: "문체는 따뜻하게 쓰되 사실만 적고 칭찬을 부풀리지 마세요.",
};

function styleRules(targetChars: number, tone: CommentTone): string[] {
  return [
    "문체는 명사형 종결의 개조식입니다. ~함, ~임, ~보임, ~됨, ~기대됨으로 끝내세요.",
    "합니다체, 대화체, 감탄문은 쓰지 마세요.",
    "관찰한 구체적 사실과 성장이 보이게 쓰세요.",
    "부족한 점은 '~하면 더 성장할 것으로 기대됨'처럼 가능성으로 적으세요.",
    "없는 사실은 만들지 마세요. 준 근거 밖 내용은 넣지 마세요.",
    "성취기준 문장을 그대로 베끼지 마세요.",
    "대회·수상, 어학·인증시험, 부모 직업과 가정 형편, 특정 대학·기관·상호·강사, 해외 활동, 자격증, 방과후학교, 사교육은 쓰지 마세요.",
    "학생마다 첫 어절과 문장 순서를 다르게 해서 문장이 겹치지 않게 하세요.",
    TONE_LINE[tone],
    `한 학생 문장은 공백 포함 약 ${targetChars}자로 맞추되, 조금 달라도 됩니다.`,
    "한 과목의 평가요소는 한 덩어리로 잇고, 요소마다 사실을 빠뜨리지 마세요.",
  ];
}

export function renderCommentPrompt(brief: CommentBrief, field: "평어" | "관찰기록"): string {
  const grade = brief.grade ? `${brief.grade}학년` : "초등학교";
  const lines = [
    `${grade} ${brief.semester}학기 ${brief.subject}의 ${field === "평어" ? "성취수준 및 특기사항" : "나이스 입력용 교과 관찰기록"}을 써 주세요.`,
    "학생의 실명, 별칭, 번호, 설문 답안은 주지 않았습니다. 지어 넣거나 답안을 인용하지 마세요.",
    ...styleRules(brief.targetChars, brief.tone),
    "",
  ];
  if (field === "관찰기록") {
    lines.push("각 평어를 나이스에 넣을 관찰기록으로 다듬으세요. 평어에 없는 사실은 추가하지 마세요.", "");
  }
  for (const student of brief.students) {
    lines.push(student.token);
    if (field === "평어") {
      if (student.memo) lines.push(`선생님 메모: ${student.memo}`);
      for (const element of student.elements) {
        lines.push(`평가요소: ${element.name}`);
        if (element.level) lines.push(`수준: ${element.level}`);
        if (element.levelDescription) lines.push(`수준 설명: ${element.levelDescription}`);
        if (element.unitTitle) lines.push(`단원: ${element.unitTitle}`);
        for (const standard of element.standards) lines.push(`성취기준: [${standard.code}] ${standard.text}`.trim());
      }
    } else {
      lines.push(`평어: ${student.memo}`);
    }
    lines.push("");
  }
  lines.push(
    "아래 JSON만 출력하세요.",
    "{",
    '  "records": [',
    `    { "학생": "학생A", "${field}": "문장" }`,
    "  ]",
    "}",
  );
  return lines.join("\n");
}

export function commentBrief(
  data: AppData,
  subjectId: string,
  studentIds: string[],
  tone: CommentTone,
  targetChars: number,
  field: "평어" | "관찰기록",
): Result<{ brief: CommentBrief; links: AnonLink[] }> {
  const subject = data.subjects.find((item) => item.id === subjectId);
  if (!subject) return { ok: false, error: "과목을 찾지 못했습니다." };
  const links = anonymizeStudents(data.students).filter((link) => studentIds.includes(link.studentId));
  const students: CommentStudent[] = [];
  for (const link of links) {
    const record = findRecord(data, link.studentId, subjectId);
    if (field === "관찰기록") {
      const source = record?.draft.trim() ?? "";
      if (!source) continue;
      students.push({ token: link.token, memo: source, elements: [] });
      continue;
    }
    const elements: CommentElement[] = [];
    for (const element of subject.elements) {
      const estimate = data.levelEstimates.find((item) => item.studentId === link.studentId && item.elementId === element.id);
      const level = estimate ? shownLevel(estimate) : "";
      if (!level && !record?.notes.trim()) continue;
      const unit = subject.units.find((item) => item.id === element.unitId);
      elements.push({
        name: element.name,
        level,
        levelDescription: element.levels.find((item) => item.label === level)?.description ?? "",
        unitTitle: unit?.title ?? "",
        standards: element.standardCodes.map((code) => ({
          code,
          text: subject.standards.find((standard) => standard.code === code)?.text ?? "",
        })),
      });
    }
    if (elements.length === 0 && !record?.notes.trim()) continue;
    students.push({ token: link.token, memo: record?.notes.trim() ?? "", elements });
  }
  if (students.length === 0) {
    return {
      ok: false,
      error: field === "평어" ? "추정 수준이나 선생님 메모가 있는 학생이 없습니다." : "다듬을 평어가 없습니다. 먼저 평어 초안을 적어 주세요.",
    };
  }
  return {
    ok: true,
    data: {
      links,
      brief: { grade: data.classInfo.grade, semester: data.classInfo.semester, subject: subject.name, tone, targetChars, students },
    },
  };
}

export function buildCommentPrompt(
  data: AppData,
  subjectId: string,
  studentIds: string[],
  tone: CommentTone,
  targetChars: number,
  field: "평어" | "관찰기록",
): Result<{ prompt: string; links: AnonLink[] }> {
  const built = commentBrief(data, subjectId, studentIds, tone, targetChars, field);
  if (!built.ok) return built;
  return { ok: true, data: { prompt: renderCommentPrompt(built.data.brief, field), links: built.data.links } };
}
