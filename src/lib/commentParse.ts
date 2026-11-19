import type { Result } from "../types";

export type ParsedComment = { token: string; text: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced?.[1] ?? raw).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("json");
  return JSON.parse(source.slice(start, end + 1));
}

export function parseCommentPaste(raw: string, field: "평어" | "관찰기록"): Result<ParsedComment[]> {
  if (!raw.trim()) return { ok: false, error: "붙여넣은 내용이 비어 있습니다." };
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ok: false, error: "문장 JSON을 읽지 못했습니다. 학생 자리표시와 문장이 있는 형식인지 확인해 주세요." };
  }
  const list = isRecord(parsed) ? parsed.records ?? parsed["문장들"] : parsed;
  if (!Array.isArray(list)) return { ok: false, error: "records 배열을 찾지 못했습니다." };
  const items: ParsedComment[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const token = String(item["학생"] ?? item.token ?? "").trim();
    const text = String(item[field] ?? item.text ?? "").trim();
    if (!token || !text) continue;
    items.push({ token, text });
  }
  if (items.length === 0) return { ok: false, error: "학생 자리표시와 문장을 찾지 못했습니다." };
  return { ok: true, data: items };
}
