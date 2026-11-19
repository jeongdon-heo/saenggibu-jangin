const SKIP_PATTERN = /◈|공개수업|학기말|총정리|재량활동|휴업|방학|학교행사/;

export function suggestSkip(title: string, content = ""): boolean {
  return SKIP_PATTERN.test(`${title} ${content}`);
}
