export type CommentRules = {
  lengthMin: number;
  lengthMax: number;
  nounEnding: boolean;
  concreteLevel: boolean;
  noHope: boolean;
  extra: string;
};

export function defaultCommentRules(): CommentRules {
  return {
    lengthMin: 250,
    lengthMax: 400,
    nounEnding: true,
    concreteLevel: true,
    noHope: true,
    extra: "",
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeCommentRules(value: unknown): CommentRules {
  const base = defaultCommentRules();
  if (!isRecord(value)) return base;
  let lengthMin = clamp(value.lengthMin, 40, 1500, base.lengthMin);
  let lengthMax = clamp(value.lengthMax, 40, 1500, base.lengthMax);
  if (lengthMax < lengthMin) [lengthMin, lengthMax] = [lengthMax, lengthMin];
  const noHope = typeof value.noHope === "boolean" ? value.noHope : typeof value.allowHope === "boolean" ? value.allowHope === false : base.noHope;
  return {
    lengthMin,
    lengthMax,
    nounEnding: flag(value.nounEnding, base.nounEnding),
    concreteLevel: flag(value.concreteLevel, base.concreteLevel),
    noHope,
    extra: typeof value.extra === "string" ? value.extra.trim().slice(0, 2000) : "",
  };
}

export function lengthBand(rules: CommentRules, grade: number | null, _subject?: string): { min: number; max: number } {
  const min = Math.min(rules.lengthMin, rules.lengthMax);
  const max = Math.max(rules.lengthMin, rules.lengthMax);
  if (grade === 1 && min === 250 && max === 400) return { min: 180, max: 220 };
  return { min, max };
}
