const ABBR: Array<[string, string]> = [
  ["슬기", "슬기로운 생활"],
  ["즐거", "즐거운 생활"],
  ["바른", "바른 생활"],
  ["실과", "실과"],
  ["국어", "국어"],
  ["수학", "수학"],
  ["사회", "사회"],
  ["과학", "과학"],
  ["도덕", "도덕"],
  ["영어", "영어"],
  ["음악", "음악"],
  ["미술", "미술"],
  ["체육", "체육"],
  ["국", "국어"],
  ["수", "수학"],
  ["사", "사회"],
  ["과", "과학"],
  ["도", "도덕"],
  ["영", "영어"],
  ["음", "음악"],
  ["미", "미술"],
  ["체", "체육"],
  ["실", "실과"],
  ["바", "바른 생활"],
  ["슬", "슬기로운 생활"],
  ["즐", "즐거운 생활"],
];

export function subjectFromCode(code: string): string | null {
  const compact = code.replace(/\s/g, "").replace(/^\[|\]$/g, "");
  const matched = compact.match(/^[1-6]([가-힣]{1,4})/);
  if (!matched) return null;
  const abbr = matched[1] ?? "";
  for (const [key, name] of ABBR) {
    if (abbr.startsWith(key)) return name;
  }
  return null;
}
