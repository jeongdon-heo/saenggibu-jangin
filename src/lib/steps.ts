export type StepStatus = "ready" | "soon" | "guide";
export type StageTone = "stage1" | "stage2" | "stage3";

export type StepInfo = {
  id: number;
  stage: 1 | 2 | 3;
  nav: string;
  title: string;
  summary: string;
  status: StepStatus;
  href: string;
  lead: string;
  paragraphs: string[];
  now: string;
  action?: { href: string; label: string };
};

export const stages = [
  { id: 1 as const, title: "학습주제와 두 방향 평가", tone: "stage1" as const },
  { id: 2 as const, title: "자기평가 배포와 수준 맞추기", tone: "stage2" as const },
  { id: 3 as const, title: "평어와 나이스 입력", tone: "stage3" as const },
];

export const stageStyle: Record<StageTone, { text: string; bg: string; soft: string; border: string }> = {
  stage1: { text: "text-stage1", bg: "bg-stage1", soft: "bg-stage1-soft", border: "border-stage1" },
  stage2: { text: "text-stage2", bg: "bg-stage2", soft: "bg-stage2-soft", border: "border-stage2" },
  stage3: { text: "text-stage3", bg: "bg-stage3", soft: "bg-stage3-soft", border: "border-stage3" },
};

export const statusLabel: Record<StepStatus, string> = {
  ready: "사용 가능",
  soon: "준비 중",
  guide: "안내",
};

export const steps: StepInfo[] = [
  {
    id: 1,
    stage: 1,
    nav: "학습주제·성취기준",
    title: "교과서 순서로 학습주제 정리",
    summary: "진도표에서 학습주제를 만들고 평가요소·성취기준과 연결합니다.",
    status: "ready",
    href: "/subjects",
    lead: "지금은 선생님이 직접 등록합니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 2,
    stage: 1,
    nav: "교사 평가",
    title: "교사 평가로 수준 표시",
    summary: "학습주제마다 관찰·지필·수행으로 상·중·하를 표시합니다.",
    status: "ready",
    href: "/teach",
    lead: "선생님이 수업에서 본 수준을 학급 표에 표시합니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 3,
    stage: 1,
    nav: "자기평가 문제",
    title: "학생 자기평가 문제 만들기",
    summary: "수준을 가늠하는 문제를 만들고 설문에 넣을 것을 고릅니다.",
    status: "ready",
    href: "/questions",
    lead: "학생 자기평가용 문제를 만듭니다. 설문에 넣을 문제는 이 화면에서 고릅니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 4,
    stage: 2,
    nav: "구글 폼 배포",
    title: "구글 폼으로 만들고 배포",
    summary: "학생에게 설문을 보냅니다.",
    status: "ready",
    href: "/forms",
    lead: "고른 문제를 선생님 구글 계정에서 폼으로 만듭니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 5,
    stage: 2,
    nav: "두 방향 수준",
    title: "설문 결과와 교사 평가 맞추기",
    summary: "학생 설문 수준과 교사 평가를 나란히 보고 확정합니다.",
    status: "ready",
    href: "/survey",
    lead: "교사 평가를 우선하고, 학생 설문과 다르면 표시합니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 6,
    stage: 3,
    nav: "평어 작성",
    title: "두 방향 평가로 평어 작성",
    summary: "확정한 교사 평가와 학생 설문 수준으로 평어 초안을 만듭니다.",
    status: "ready",
    href: "/records",
    lead: "확정한 교사 평가와 학생 설문 수준으로 초안을 만듭니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 7,
    stage: 3,
    nav: "관찰기록 생성",
    title: "나이스 입력용 관찰기록 생성",
    summary: "수행평가가 아닌 내용이 평어에 있으면 관찰기록을 만듭니다.",
    status: "ready",
    href: "/observe",
    lead: "관찰·지필 근거가 있는 문장만 나이스 관찰기록으로 다듬습니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 8,
    stage: 3,
    nav: "나이스 입력",
    title: "나이스에 입력",
    summary: "복사한 문장을 나이스에 붙여넣습니다.",
    status: "ready",
    href: "/neis",
    lead: "나이스에는 선생님이 직접 입력합니다. 이 앱은 나이스에 로그인하지 않습니다.",
    paragraphs: [
      "1. 평어 작성 화면에서 학생 옆의 ‘문장 복사’를 누릅니다.",
      "2. 나이스 교과학습발달상황의 ‘성취수준 및 특기사항’ 칸에 붙여넣습니다.",
      "3. 글자 수와 바이트는 참고입니다. 2026학년도 초등은 이 항목에 고정 글자 수 제한이 없고, 시스템 입력 범위 안에서 작성하면 됩니다.",
      "학급 전체를 엑셀 파일로 내려받아 대조할 수도 있습니다. 엑셀에는 실명과 관찰 메모를 넣지 않습니다.",
    ],
    now: "문장을 복사하는 화면으로 이동하면 바로 붙여넣을 수 있습니다.",
    action: { href: "/records", label: "문장 복사하러 가기" },
  },
];

export function stepById(id: number): StepInfo | undefined {
  return steps.find((step) => step.id === id);
}
