import type { AppData, Result } from "../types";
import { defaultCommentRules, lengthBand, type CommentRules } from "./commentRules";
import { evidenceLabel, markDraft } from "./evidence";
import { findRecord, sortedStudents } from "./model";
import { combinedFor, EVIDENCE_LABEL, levelForComment } from "./teacherAssess";

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
  surveyLevel: string;
  teacherLevel: string;
  evidences: string[];
  teacherNotes: string[];
  disagree: boolean;
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
  rules: CommentRules;
  students: CommentStudent[];
};

const TONE_LINE: Record<CommentTone, string> = {
  plain: "문체는 담백하게 쓰고 꾸미는 말은 줄이세요.",
  warm: "문체는 따뜻하게 쓰되 사실만 적고 칭찬을 부풀리지 마세요.",
};

export function commentStyleLines(rules: CommentRules, grade: number | null, subject: string, tone: CommentTone, field: "평어" | "관찰기록"): string[] {
  const band = lengthBand(rules, grade, subject);
  const lines = [
    `한 과목은 ${Math.min(rules.sentenceMin, rules.sentenceMax)}~${Math.max(rules.sentenceMin, rules.sentenceMax)}문장으로 쓰고, 문장은 단원이나 성취기준마다 나누세요.`,
    "각 문장은 학습 내용이나 활동, 그리고 수행 정도나 능력을 담으세요. 태도는 필요할 때만 붙이세요.",
    rules.allowHope
      ? "성장이 더 필요하면 '앞으로 ~하기를 바람'처럼 기대를 한 문장 적어도 됩니다."
      : "앞으로 ~하기를 바람, 기대됨처럼 앞으로의 기대를 적지 마세요.",
    "종결은 명사형만 쓰세요. 입니다체와 해요체는 쓰지 마세요.",
    `어미는 대략 ~함 ${rules.endings.ham}%, ~음·ㅁ(나타냄, 만듦, 앎, 씀. 표현함은 ~함) ${rules.endings.eum}%, ~할 수 있음 ${rules.endings.can}%, ~임·보임 ${rules.endings.im}%, ~있음 ${rules.endings.has}%로 섞으세요.`,
    "상·중·하라는 수준 이름은 문장에 쓰지 마세요. 수준은 부사와 동사로만 드러내세요.",
    `높은 수준: ${rules.highWords.join(", ") || "준 수준 설명에 맞게"}`,
    `중간 수준: ${rules.midWords.join(", ") || "준 수준 설명에 맞게"}`,
    `기초 수준: ${rules.lowWords.join(", ") || "준 수준 설명에 맞게"}. 약한 점은 노력, 과정, 보완으로 적고 미흡·부족이라고 단정하지 마세요.`,
    field === "평어"
      ? `글자 수는 공백 포함 ${band.min}~${band.max}자를 목표로 하세요. 250~400자는 나이스 바이트 약 600~1,000에 가깝습니다.`
      : "관찰기록은 준 문장만 다듬으세요. 문장 수와 글자 수 목표는 평어용이며, 근거보다 길게 늘리지 마세요.",
    "없는 사실은 만들지 마세요. 준 근거 밖 내용은 넣지 마세요.",
    "성취기준 문장을 그대로 베끼지 마세요.",
    "학생마다 성취기준의 뼈대는 같아도 문장 전체를 같이 쓰지 마세요. 정도 부사와 수행 동사를 학생마다 바꾸세요.",
    rules.varyWords.length > 0 ? `같은 말에 치우치지 마세요: ${rules.varyWords.join(", ")}` : "",
    "교외 수상, 대회 수상, 사교육, 기관명, 가족 신상, 어학·인증시험, 부모 직업과 가정 형편, 특정 대학·상호·강사, 해외 활동, 자격증, 방과후학교는 쓰지 마세요.",
    "한 과목의 평가요소는 한 덩어리로 잇고, 요소마다 사실을 빠뜨리지 마세요.",
    "교사 평가와 학생 설문 수준이 다르면 교사 평가 수준으로 쓰세요. 수준 이름은 문장에 옮기지 마세요.",
    "관찰·지필 메모에 있는 사실만 그 근거로 적어도 됩니다. 수행평가 수준만 있는 내용은 관찰한 것처럼 꾸미지 마세요.",
    TONE_LINE[tone],
    rules.extra.trim() ? `선생님 추가 규칙: ${rules.extra.trim()}` : "",
  ];
  return lines.filter(Boolean);
}

export function renderCommentPrompt(brief: CommentBrief, field: "평어" | "관찰기록"): string {
  const grade = brief.grade ? `${brief.grade}학년` : "초등학교";
  const lines = [
    `${grade} ${brief.semester}학기 ${brief.subject}의 ${field === "평어" ? "성취수준 및 특기사항" : "나이스 입력용 교과 관찰기록"}을 써 주세요.`,
    "학생의 실명, 별칭, 번호, 설문 답안은 주지 않았습니다. 지어 넣거나 답안을 인용하지 마세요.",
    ...commentStyleLines(brief.rules, brief.grade, brief.subject, brief.tone, field),
    "",
  ];
  if (field === "관찰기록") {
    lines.push("수행평가가 아닌 관찰·지필 근거가 있는 문장만 나이스 관찰기록으로 다듬으세요. 평어에 없는 사실은 추가하지 마세요.", "");
  }
  for (const student of brief.students) {
    lines.push(student.token);
    if (field === "평어") {
      if (student.memo) lines.push(`관찰 메모: ${student.memo}`);
      for (const element of student.elements) {
        lines.push(`평가요소: ${element.name}`);
        if (element.level) lines.push(`평어에 쓸 수준: ${element.level}`);
        if (element.teacherLevel) lines.push(`교사 평가: ${element.teacherLevel}`);
        if (element.surveyLevel) lines.push(`학생 설문 수준: ${element.surveyLevel}`);
        if (element.disagree) lines.push("두 평가가 다릅니다. 교사 평가를 우선하세요.");
        if (element.evidences.length > 0) lines.push(`근거: ${element.evidences.join(", ")}`);
        for (const note of element.teacherNotes) lines.push(`교사 메모: ${note}`);
        if (element.levelDescription) lines.push(`수준 설명: ${element.levelDescription}`);
        if (element.unitTitle) lines.push(`단원: ${element.unitTitle}`);
        for (const standard of element.standards) lines.push(`성취기준: [${standard.code}] ${standard.text}`.trim());
      }
    } else {
      lines.push(`관찰·지필 근거 문장: ${student.memo}`);
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
      const flagged = markDraft(data, link.studentId, subjectId, source).filter((mark) => mark.needsObservation);
      if (flagged.length === 0) continue;
      const memo = flagged.map((mark) => `(${mark.kinds.map((kind) => evidenceLabel(kind)).join(", ")}) ${mark.text}`).join("\n");
      students.push({ token: link.token, memo, elements: [] });
      continue;
    }
    const rows = combinedFor(data, subjectId, link.studentId);
    const elements: CommentElement[] = [];
    for (const element of subject.elements) {
      const row = rows.find((item) => item.elementId === element.id);
      const level = row ? levelForComment(row) : "";
      const teacherNotes = row?.notes ?? [];
      if (!level && !record?.notes.trim() && teacherNotes.length === 0) continue;
      const unit = subject.units.find((item) => item.elementId === element.id && !item.skipped) ?? subject.units.find((item) => item.id === element.unitId);
      elements.push({
        name: element.name,
        level,
        levelDescription: element.levels.find((item) => item.label === level)?.description ?? "",
        unitTitle: unit?.title ?? "",
        standards: element.standardCodes.map((code) => ({
          code,
          text: subject.standards.find((standard) => standard.code === code)?.text ?? "",
        })),
        surveyLevel: row?.surveyLevel ?? "",
        teacherLevel: row?.teacherLevel ?? "",
        evidences: (row?.evidences ?? []).map((kind) => EVIDENCE_LABEL[kind]),
        teacherNotes,
        disagree: row?.disagree ?? false,
      });
    }
    if (elements.length === 0 && !record?.notes.trim()) continue;
    students.push({ token: link.token, memo: record?.notes.trim() ?? "", elements });
  }
  if (students.length === 0) {
    return {
      ok: false,
      error:
        field === "평어"
          ? "확정 수준이나 선생님 메모가 있는 학생이 없습니다."
          : "수행평가가 아닌 근거가 평어에 없습니다. 관찰·지필 내용이 들어간 문장만 관찰기록으로 만듭니다.",
    };
  }
  return {
    ok: true,
    data: {
      links,
      brief: {
        grade: data.classInfo.grade,
        semester: data.classInfo.semester,
        subject: subject.name,
        tone,
        targetChars,
        rules: data.commentRules ?? defaultCommentRules(),
        students,
      },
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
