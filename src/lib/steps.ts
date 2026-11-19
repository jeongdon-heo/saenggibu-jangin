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
  { id: 1 as const, title: "AI 준비와 문제 만들기", tone: "stage1" as const },
  { id: 2 as const, title: "배포와 설문", tone: "stage2" as const },
  { id: 3 as const, title: "기록 작성과 입력", tone: "stage3" as const },
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
    nav: "평가계획·성취기준",
    title: "학교 평가계획과 성취기준 등록",
    summary: "학교 평가계획과 2022 개정 교육과정 성취기준을 등록합니다.",
    status: "ready",
    href: "/subjects",
    lead: "지금은 선생님이 직접 등록합니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 2,
    stage: 1,
    nav: "문제 만들기",
    title: "성취수준을 파악하는 문제 만들기",
    summary: "학생 수준을 살필 수 있는 문제를 만듭니다.",
    status: "soon",
    href: "/steps/2",
    lead: "학생의 성취수준을 살필 문제를 만드는 단계입니다.",
    paragraphs: [
      "다음 작업에서 인공지능으로 문제를 만들 계획입니다.",
      "학생 이름과 번호는 인공지능에 보내지 않을 예정입니다. 성취기준과 평가계획만 보내고, 학생 정보는 이 브라우저에 남겨 둡니다.",
    ],
    now: "지금은 과목마다 성취기준을 먼저 등록해 주세요.",
    action: { href: "/subjects", label: "성취기준 등록하기" },
  },
  {
    id: 3,
    stage: 1,
    nav: "과목별 문제 선택",
    title: "응답받을 문제를 과목별로 선택",
    summary: "설문에 넣을 문제를 과목마다 고릅니다.",
    status: "soon",
    href: "/steps/3",
    lead: "만든 문제 가운데 학생에게 물어볼 문제를 과목별로 고르는 단계입니다.",
    paragraphs: ["문제 만들기가 준비된 뒤에 열립니다."],
    now: "지금은 학급 명단과 과목을 정리해 두면 됩니다.",
    action: { href: "/class", label: "학급 설정으로 가기" },
  },
  {
    id: 4,
    stage: 2,
    nav: "구글 폼 배포",
    title: "구글 폼으로 만들고 배포",
    summary: "학생에게 설문을 보냅니다.",
    status: "soon",
    href: "/steps/4",
    lead: "고른 문제를 구글 폼으로 만들어 학생에게 보내는 단계입니다.",
    paragraphs: ["이 앱은 구글 계정과 연결하지 않습니다. 폼 만들기는 아직 준비 중입니다."],
    now: "설문 없이도 수업에서 본 내용을 평어 화면에 적을 수 있습니다.",
    action: { href: "/records", label: "평어 작성으로 가기" },
  },
  {
    id: 5,
    stage: 2,
    nav: "학생 설문",
    title: "학생 설문과 응답 살펴보기",
    summary: "응답을 모아 누가 어떻게 답했는지 살핍니다.",
    status: "soon",
    href: "/steps/5",
    lead: "학생 응답을 모아 살피는 단계입니다.",
    paragraphs: ["응답도 서버가 아니라 이 브라우저 안에서만 다루도록 만들 예정입니다."],
    now: "지금은 선생님이 본 모습을 관찰 메모에 직접 적으면 됩니다.",
    action: { href: "/records", label: "기록 메모로 가기" },
  },
  {
    id: 6,
    stage: 3,
    nav: "평어 작성",
    title: "교과학습발달상황 및 성취수준 작성",
    summary: "평어를 직접 적고 글자 수와 바이트를 확인합니다.",
    status: "ready",
    href: "/records",
    lead: "지금은 선생님이 직접 작성합니다.",
    paragraphs: [],
    now: "",
  },
  {
    id: 7,
    stage: 3,
    nav: "관찰기록 생성",
    title: "나이스 입력용 관찰기록 생성",
    summary: "평어에 맞는 관찰기록 문장을 만듭니다.",
    status: "soon",
    href: "/steps/7",
    lead: "적은 평어를 바탕으로 나이스에 넣을 문장을 다듬는 단계입니다.",
    paragraphs: ["인공지능이 문장을 만들어 주는 기능은 아직 없습니다."],
    now: "지금은 평어 작성 화면에서 문장을 직접 쓰고 복사할 수 있습니다. 글자 수와 바이트도 그 화면에서 바로 보입니다.",
    action: { href: "/records", label: "평어 작성으로 가기" },
  },
  {
    id: 8,
    stage: 3,
    nav: "나이스 입력",
    title: "나이스에 입력",
    summary: "복사한 문장을 나이스에 붙여넣습니다.",
    status: "guide",
    href: "/steps/8",
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
