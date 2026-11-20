import type { ParsedElement } from "./elementsParse";
import { findCodes, canonicalCode, type ParsedPlanItem, type ParsedStandard } from "./parse";
import type { ExtractedSubject } from "./planDocument";

export const PLAN_AI_SYSTEM =
  "학교 평가계획 문서만 정리합니다. 학생의 이름, 번호, 생활기록은 받지 않았고 만들어 넣지도 않습니다. JSON만 출력합니다.";

const PROMPT_LIMIT = 12000;

export function buildPlanPrompt(plain: string): { prompt: string; truncated: boolean } {
  const truncated = plain.length > PROMPT_LIMIT;
  const body = plain.slice(0, PROMPT_LIMIT);
  const lines = [
    "아래는 학교 평가계획 문서에서 이 브라우저가 읽어 낸 글입니다.",
    "학생 이름, 번호, 별칭, 생활기록 문장은 들어 있지 않아야 합니다. 문서에 없다면 지어 넣지 마세요.",
    "평가계획 행, 성취기준, 평가요소와 수준별 기준을 과목별로 나누세요.",
    "성취기준 코드는 4국02-01처럼 적고, 문서에 있는 수준 이름(잘함, 보통, 노력요함 또는 상, 중, 하 등)을 그대로 쓰세요.",
    "문서에 없는 평가 내용이나 기준은 만들지 마세요.",
  ];
  if (truncated) lines.push("문서가 길어 앞부분만 포함했습니다.");
  lines.push(
    "",
    "문서",
    body || "(읽어 낸 글이 없습니다.)",
    "",
    "아래 JSON만 출력하세요.",
    "{",
    '  "subjects": [',
    "    {",
    '      "name": "국어",',
    '      "plan": [{"area": "", "content": "", "method": "", "ratio": "", "note": ""}],',
    '      "standards": [{"code": "4국02-01", "text": ""}],',
    '      "elements": [{"name": "", "unitTitle": "", "standardCodes": ["4국02-01"], "levels": [{"label": "잘함", "description": ""}], "note": ""}]',
    "    }",
    "  ]",
    "}",
  );
  return { prompt: lines.join("\n"), truncated };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced?.[1] ?? raw).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("json");
  return JSON.parse(source.slice(start, end + 1));
}

function codesOf(value: unknown): string[] {
  const source = Array.isArray(value) ? value.map(textOf).join(" ") : textOf(value);
  const found = findCodes(source);
  if (found.length > 0) return found;
  return source
    .split(/[,，\s]+/)
    .map((item) => canonicalCode(item) ?? item.replace(/^\[|\]$/g, "").trim())
    .filter((item) => item.length > 0 && item.length <= 20);
}

function levelsOf(value: unknown): Array<{ label: string; description: string }> {
  if (!Array.isArray(value)) return [];
  const levels: Array<{ label: string; description: string }> = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const label = textOf(item.label ?? item["수준"] ?? item["이름"]);
    const description = textOf(item.description ?? item["기준"] ?? item["설명"] ?? item["내용"]);
    if (!label && !description) continue;
    levels.push({ label, description });
  }
  return levels;
}

function subjectOf(value: unknown): ExtractedSubject | null {
  if (!isRecord(value)) return null;
  const plan: ParsedPlanItem[] = [];
  const planSource = value.plan ?? value["평가계획"] ?? value["항목"];
  if (Array.isArray(planSource)) {
    for (const item of planSource) {
      if (!isRecord(item)) continue;
      const next: ParsedPlanItem = {
        area: textOf(item.area ?? item["영역"]),
        content: textOf(item.content ?? item["내용"] ?? item["평가내용"]),
        method: textOf(item.method ?? item["방법"]),
        ratio: textOf(item.ratio ?? item["비율"] ?? item["반영비율"]),
        note: textOf(item.note ?? item["비고"]),
      };
      if (next.area || next.content || next.method || next.ratio) plan.push(next);
    }
  }
  const standards: ParsedStandard[] = [];
  const standardSource = value.standards ?? value["성취기준"];
  if (Array.isArray(standardSource)) {
    for (const item of standardSource) {
      if (typeof item === "string") {
        const codes = findCodes(item);
        if (codes.length === 0) continue;
        standards.push({ code: codes[0] ?? "", text: item.replace(/\[[^\]]+\]/, "").trim() });
        continue;
      }
      if (!isRecord(item)) continue;
      const rawCode = textOf(item.code ?? item["코드"]);
      const code = canonicalCode(rawCode) ?? findCodes(rawCode)[0] ?? rawCode.replace(/^\[|\]$/g, "");
      const text = textOf(item.text ?? item["내용"] ?? item["성취기준"]);
      if (!code) continue;
      standards.push({ code, text });
    }
  }
  const elements: ParsedElement[] = [];
  const elementSource = value.elements ?? value["평가요소"];
  if (Array.isArray(elementSource)) {
    for (const item of elementSource) {
      if (!isRecord(item)) continue;
      const name = textOf(item.name ?? item["평가요소"] ?? item["이름"]);
      if (!name) continue;
      elements.push({
        name,
        unitTitle: textOf(item.unitTitle ?? item["단원"]),
        standardCodes: codesOf(item.standardCodes ?? item["성취기준"]),
        levels: levelsOf(item.levels ?? item["수준"]),
        note: textOf(item.note ?? item["비고"]),
      });
    }
  }
  if (plan.length === 0 && standards.length === 0 && elements.length === 0) return null;
  return {
    name: textOf(value.name ?? value["과목"]).slice(0, 30),
    plan,
    standards,
    elements,
    warnings: ["AI가 정리한 결과입니다. 문서와 견주어 확인하고 넣으세요."],
  };
}

export function parsePlanAiResponse(raw: string): { subjects: ExtractedSubject[] } | { error: string } {
  if (!raw.trim()) return { error: "인공지능 응답이 비어 있습니다." };
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { error: "인공지능 응답에서 JSON을 읽지 못했습니다. 다시 시도하거나 미리보기에서 직접 고쳐 주세요." };
  }
  const list = isRecord(parsed) ? (parsed.subjects ?? parsed["과목"] ?? parsed["subjects"]) : parsed;
  if (!Array.isArray(list)) return { error: "과목 목록을 찾지 못했습니다." };
  const subjects = list.map(subjectOf).filter((item): item is ExtractedSubject => item !== null);
  if (subjects.length === 0) return { error: "평가계획, 성취기준, 평가요소를 찾지 못했습니다." };
  return { subjects };
}
