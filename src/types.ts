export const DATA_VERSION = 1;

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

export type Subject = {
  id: string;
  name: string;
  plan: AssessmentItem[];
  standards: Standard[];
};

export type StudentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  notes: string;
  draft: string;
  updatedAt: string;
};

export type AppData = {
  version: typeof DATA_VERSION;
  classInfo: ClassInfo;
  students: Student[];
  subjects: Subject[];
  records: StudentRecord[];
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
