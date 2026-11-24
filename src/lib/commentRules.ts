export type CommentEndingMix = {
  ham: number;
  eum: number;
  can: number;
  im: number;
  has: number;
};

export type CommentLengthRule = {
  grade: number | null;
  subject: string;
  min: number;
  max: number;
};

export type CommentRules = {
  sentenceMin: number;
  sentenceMax: number;
  allowHope: boolean;
  endings: CommentEndingMix;
  highWords: string[];
  midWords: string[];
  lowWords: string[];
  lengthMin: number;
  lengthMax: number;
  lengths: CommentLengthRule[];
  varyWords: string[];
  extra: string;
};

const HIGH = ["정확하게", "능숙하게", "자신 있게", "능력이 뛰어남", "탁월함"];
const MID = ["바르게", "할 수 있음", "이해함", "참여함", "꾸준히", "성실히"];
const LOW = ["대체로", "무난한 수행", "도움을 받아", "일부를 이해함", "기초적인"];
const VARY = ["표현함", "이해함", "참여함", "설명함", "적극적으로", "즐겁게"];

export function defaultCommentRules(): CommentRules {
  return {
    sentenceMin: 3,
    sentenceMax: 6,
    allowHope: false,
    endings: { ham: 60, eum: 20, can: 10, im: 5, has: 5 },
    highWords: [...HIGH],
    midWords: [...MID],
    lowWords: [...LOW],
    lengthMin: 250,
    lengthMax: 400,
    lengths: [
      { grade: 1, subject: "", min: 180, max: 220 },
      { grade: 2, subject: "국어", min: 350, max: 400 },
      { grade: 3, subject: "국어", min: 350, max: 400 },
      { grade: 2, subject: "수학", min: 350, max: 400 },
      { grade: 3, subject: "수학", min: 350, max: 400 },
      { grade: null, subject: "바른 생활", min: 350, max: 400 },
      { grade: null, subject: "슬기로운 생활", min: 350, max: 400 },
      { grade: null, subject: "즐거운 생활", min: 350, max: 400 },
    ],
    varyWords: [...VARY],
    extra: "",
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function wordList(value: unknown, fallback: string[]): string[] {
  if (value === undefined || value === null) return [...fallback];
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，\n]/) : null;
  if (!source) return [...fallback];
  const words: string[] = [];
  for (const item of source) {
    if (typeof item !== "string") continue;
    const word = item.trim().slice(0, 40);
    if (!word || words.includes(word)) continue;
    words.push(word);
    if (words.length >= 30) break;
  }
  return words;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeCommentRules(value: unknown): CommentRules {
  const base = defaultCommentRules();
  if (!isRecord(value)) return base;
  const endings = isRecord(value.endings) ? value.endings : {};
  let sentenceMin = clamp(value.sentenceMin, 1, 12, base.sentenceMin);
  let sentenceMax = clamp(value.sentenceMax, 1, 12, base.sentenceMax);
  if (sentenceMax < sentenceMin) [sentenceMin, sentenceMax] = [sentenceMax, sentenceMin];
  let lengthMin = clamp(value.lengthMin, 40, 1500, base.lengthMin);
  let lengthMax = clamp(value.lengthMax, 40, 1500, base.lengthMax);
  if (lengthMax < lengthMin) [lengthMin, lengthMax] = [lengthMax, lengthMin];
  const lengths: CommentLengthRule[] = [];
  const rawLengths = value.lengths;
  const hasLengths = Array.isArray(rawLengths);
  if (hasLengths) {
    for (const item of rawLengths) {
      if (!isRecord(item)) continue;
      const grade = item.grade === null || item.grade === "" || item.grade === undefined ? null : clamp(item.grade, 1, 6, 0);
      if (grade === 0) continue;
      let min = clamp(item.min, 40, 1500, lengthMin);
      let max = clamp(item.max, 40, 1500, lengthMax);
      if (max < min) [min, max] = [max, min];
      lengths.push({
        grade,
        subject: typeof item.subject === "string" ? item.subject.trim().slice(0, 30) : "",
        min,
        max,
      });
      if (lengths.length >= 24) break;
    }
  }
  return {
    sentenceMin,
    sentenceMax,
    allowHope: value.allowHope === true,
    endings: {
      ham: clamp(endings.ham, 0, 100, base.endings.ham),
      eum: clamp(endings.eum, 0, 100, base.endings.eum),
      can: clamp(endings.can, 0, 100, base.endings.can),
      im: clamp(endings.im, 0, 100, base.endings.im),
      has: clamp(endings.has, 0, 100, base.endings.has),
    },
    highWords: wordList(value.highWords, base.highWords),
    midWords: wordList(value.midWords, base.midWords),
    lowWords: wordList(value.lowWords, base.lowWords),
    lengthMin,
    lengthMax,
    lengths: hasLengths ? lengths : base.lengths,
    varyWords: wordList(value.varyWords, base.varyWords),
    extra: typeof value.extra === "string" ? value.extra.trim().slice(0, 2000) : "",
  };
}

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

export function lengthBand(rules: CommentRules, grade: number | null, subject: string): { min: number; max: number } {
  let best = -1;
  let band = { min: rules.lengthMin, max: rules.lengthMax };
  const name = compact(subject);
  for (const row of rules.lengths) {
    const subjectOk = row.subject ? compact(row.subject) === name : true;
    const gradeOk = row.grade != null ? row.grade === grade : true;
    if (!subjectOk || !gradeOk) continue;
    if (!row.subject && row.grade == null) continue;
    const score = (row.subject ? 2 : 0) + (row.grade != null ? 1 : 0);
    if (score > best) {
      best = score;
      band = row.min <= row.max ? { min: row.min, max: row.max } : { min: row.max, max: row.min };
    }
  }
  return band.min <= band.max ? band : { min: band.max, max: band.min };
}
