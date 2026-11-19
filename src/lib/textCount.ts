/**
 * 2026학년도 초등 학교생활기록부 기재요령의 입력 분량 계산.
 * 한글 1자 = 3바이트, 영문·숫자 1자 = 1바이트, 줄바꿈(Enter) = 1바이트.
 * 공백은 기재요령에 기준이 없어 ASCII 공백을 1바이트로 본다.
 * 윈도우 줄바꿈(\r\n)은 줄바꿈 한 번으로 센다.
 * ASCII가 아닌 문자(한글, 한자, 전각문자 등)는 3바이트로 본다.
 */
export const COUNT_NOTES = [
  "한글 1자는 3바이트입니다.",
  "영문과 숫자 1자는 1바이트입니다.",
  "줄바꿈(Enter)은 1바이트입니다. 윈도우 줄바꿈도 한 번으로 셉니다.",
  "공백은 기재요령에 따로 적혀 있지 않아 1바이트로 계산합니다.",
  "영문 문장부호처럼 ASCII 문자는 1바이트, 한자 등 그 외 문자는 3바이트입니다.",
  "글자 수는 공백과 줄바꿈을 포함합니다.",
  "2026학년도 초등 교과학습발달상황에는 고정 글자 수 제한이 없습니다. 시스템 입력 범위 안에서 작성하면 됩니다.",
] as const;

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function countChars(text: string): number {
  return [...normalizeNewlines(text)].length;
}

export function countLabel(text: string): string {
  if (!text.trim()) return "아직 없음";
  return `${countChars(text)}자 · ${countNeisBytes(text)}바이트`;
}

export function countNeisBytes(text: string): number {
  const normalized = normalizeNewlines(text);
  let bytes = 0;
  for (const char of normalized) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    bytes += code <= 0x7f ? 1 : 3;
  }
  return bytes;
}
