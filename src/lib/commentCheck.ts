export type CheckFlag = {
  severity: "warn";
  code: string;
  message: string;
  suggestion: string;
};

const BANNED: Array<{ pattern: RegExp; message: string; suggestion: string }> = [
  { pattern: /대회|수상|우승|입상|금상|은상|동상|표창/, message: "교내외 대회나 수상이 들어가 있습니다.", suggestion: "대회와 상은 빼고, 수업에서 보인 모습만 적으세요." },
  { pattern: /토익|토플|한자능력|인증시험|공인영어|공인시험/, message: "어학·인증시험이 들어가 있습니다.", suggestion: "시험 이름과 점수는 빼세요." },
  { pattern: /부모|아버지|어머니|가정형편|경제적|직업이/, message: "가족이나 경제적 배경이 들어가 있습니다.", suggestion: "학생 자신의 학습 모습만 적으세요." },
  { pattern: /대학교|서울대|연세대|고려대|학원|강사|과외/, message: "특정 대학·기관·강사나 사교육이 들어가 있습니다.", suggestion: "학교 수업에서 본 내용만 남기세요." },
  { pattern: /해외|유학|어학연수/, message: "해외 활동이 들어가 있습니다.", suggestion: "해외 경험은 적지 마세요." },
  { pattern: /자격증/, message: "자격증이 들어가 있습니다.", suggestion: "자격 이름은 빼세요." },
  { pattern: /방과후|방과 후/, message: "방과후학교가 들어가 있습니다.", suggestion: "정규 수업에서 보인 모습만 적으세요." },
  { pattern: /사교육/, message: "사교육이 들어가 있습니다.", suggestion: "학교 수업 관찰만 적으세요." },
];

const LOUD = ["매우", "대단히", "탁월", "완벽", "최고", "언제나", "항상", "모든 학생", "놀라운"];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.。])\s*|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function endingOk(sentence: string): boolean {
  return /(함|됨|임|보임|있음|없음|바람|필요함|기대됨)\.?$/.test(sentence.replace(/\s/g, ""));
}

export function checkComment(text: string, context: { answers: string[]; standardTexts: string[] }): CheckFlag[] {
  const flags: CheckFlag[] = [];
  const body = text.trim();
  if (!body) return flags;
  for (const rule of BANNED) {
    if (rule.pattern.test(body)) flags.push({ severity: "warn", code: "banned", message: rule.message, suggestion: rule.suggestion });
  }
  const foundLoud = LOUD.filter((word) => body.includes(word));
  if (foundLoud.length > 0) {
    flags.push({
      severity: "warn",
      code: "loud",
      message: `과장으로 보일 수 있는 말이 있습니다. ${foundLoud.join(", ")}`,
      suggestion: "정도를 줄이고 본 행동만 적으세요.",
    });
  }
  const parts = sentences(body);
  const casual = parts.filter((sentence) => /(?:합니다|입니다|해요|이에요|예요|습니까|까요)/.test(sentence));
  const nounEnd = parts.filter(endingOk);
  if (casual.length > 0) {
    flags.push({
      severity: "warn",
      code: "style",
      message: "합니다체나 대화체가 섞여 있습니다.",
      suggestion: "문장 끝을 ~함, ~임, ~보임으로 고치세요.",
    });
  } else if (nounEnd.length < parts.length) {
    flags.push({
      severity: "warn",
      code: "ending",
      message: "명사형으로 끝나지 않은 문장이 있습니다.",
      suggestion: "각 문장을 ~함, ~보임, ~기대됨으로 맞추세요.",
    });
  }
  for (const answer of context.answers) {
    const quote = answer.trim();
    if (quote.length >= 6 && body.includes(quote)) {
      flags.push({
        severity: "warn",
        code: "answer",
        message: "학생 답안이 문장 안에 그대로 있습니다.",
        suggestion: "답안을 인용하지 말고, 수업에서 보인 행동으로 다시 쓰세요.",
      });
      break;
    }
  }
  for (const standard of context.standardTexts) {
    const source = standard.trim();
    if (source.length >= 12 && body.includes(source)) {
      flags.push({
        severity: "warn",
        code: "standard",
        message: "성취기준 문장이 그대로 들어가 있습니다.",
        suggestion: "기준 문장을 베끼지 말고, 그 기준이 드러난 장면으로 바꾸세요.",
      });
      break;
    }
  }
  return flags;
}

function bigrams(text: string): Set<string> {
  const compact = text.replace(/\s+/g, "");
  const grams = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) grams.add(compact.slice(index, index + 2));
  return grams;
}

export function textSimilarity(left: string, right: string): number {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function findNearDuplicates(items: Array<{ id: string; text: string }>, threshold = 0.72): Array<{ a: string; b: string; score: number }> {
  const hits: Array<{ a: string; b: string; score: number }> = [];
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const first = items[left];
      const second = items[right];
      if (!first || !second || first.text.trim().length < 8 || second.text.trim().length < 8) continue;
      const score = textSimilarity(first.text, second.text);
      if (score >= threshold) hits.push({ a: first.id, b: second.id, score });
    }
  }
  return hits;
}
