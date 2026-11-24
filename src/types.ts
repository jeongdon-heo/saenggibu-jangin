export const DATA_VERSION = 3;

export type Semester = 1 | 2;

export type ClassInfo = {
  schoolYear: number;
  semester: Semester;
  grade: number | null;
  classLabel: string;
};

export type Student = {
  id: string;
  number: number;
  alias: string;
  realName: string;
};

export type AssessmentItem = {
  id: string;
  area: string;
  content: string;
  method: string;
  ratio: string;
  note: string;
};

export type Standard = {
  id: string;
  code: string;
  text: string;
};

export type Unit = {
  id: string;
  order: number;
  grade: number | null;
  semester: number | null;
  organization: string;
  title: string;
  content: string;
  pages: string;
  extraPages: string;
  period: string;
  totalPeriods: string;
  materials: string;
  skipped: boolean;
  elementId: string;
  chosenPages?: string;
};

export type ProgressLesson = {
  id: string;
  order: number;
  grade: number | null;
  semester: number | null;
  title: string;
  content: string;
  pages: string;
  extraPages: string;
  period: string;
};

export type EvidenceKind = "observe" | "paper" | "performance";

export type TeacherCheck = {
  id: string;
  studentId: string;
  subjectId: string;
  unitId: string;
  level: string;
  evidences: EvidenceKind[];
  note: string;
};

export type LevelDecision = {
  id: string;
  studentId: string;
  subjectId: string;
  elementId: string;
  level: string;
  confirmed: boolean;
};

export type LevelCriterion = {
  id: string;
  label: string;
  description: string;
};

export type EvaluationElement = {
  id: string;
  name: string;
  unitId: string;
  standardCodes: string[];
  levels: LevelCriterion[];
  note: string;
};

export type QuestionTypeId = "choice" | "short" | "essay" | "check";

export type Question = {
  id: string;
  subjectId: string;
  elementId: string;
  elementName: string;
  standardCodes: string[];
  targetLevel: string;
  type: QuestionTypeId;
  prompt: string;
  choices: string[];
  answer: string;
  rubric: string;
  approved: boolean;
  selected: boolean;
  order: number;
};

export type AiProviderId = "openai" | "gemini";

export type AiSettings = {
  provider: AiProviderId;
  model: string;
  rememberKey: boolean;
};

export type Subject = {
  id: string;
  name: string;
  plan: AssessmentItem[];
  standards: Standard[];
  units: Unit[];
  elements: EvaluationElement[];
  lessons?: ProgressLesson[];
};

export type StudentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  notes: string;
  draft: string;
  observation: string;
  draftConfirmed: boolean;
  observationConfirmed: boolean;
  updatedAt: string;
};

export type ScoreMark = "correct" | "incorrect" | "partial" | "unscored";

export type SurveyAnswer = {
  questionId: string;
  raw: string;
  autoScore: ScoreMark;
  teacherScore: "" | "correct" | "incorrect" | "partial";
  note: string;
};

export type SurveyResponse = {
  id: string;
  studentId: string | null;
  numberText: string;
  submittedAt: string;
  answers: SurveyAnswer[];
};

export type LevelEstimate = {
  id: string;
  studentId: string;
  subjectId: string;
  elementId: string;
  elementName: string;
  suggestedLevel: string;
  teacherLevel: string;
  note: string;
};

import type { CommentRules } from "./lib/commentRules";

export type AppData = {
  version: typeof DATA_VERSION;
  classInfo: ClassInfo;
  students: Student[];
  subjects: Subject[];
  records: StudentRecord[];
  questions: Question[];
  responses: SurveyResponse[];
  levelEstimates: LevelEstimate[];
  teacherChecks: TeacherCheck[];
  levelDecisions: LevelDecision[];
  aiSettings: AiSettings;
  commentRules: CommentRules;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
