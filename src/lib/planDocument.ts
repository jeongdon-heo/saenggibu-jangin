import type { DocBlock } from "./documentBlocks";
import type { ParsedElement } from "./elementsParse";
import { parseElements } from "./elementsParse";
import { cleanUnitTitle } from "./curriculum";
import { readHwpxBlocks } from "./hwpxRead";
import { findCodes, parseStandards, type ParsedPlanItem, type ParsedStandard } from "./parse";
import { subjectFromCode } from "./subjectCode";
import type { Result } from "../types";

export type ExtractedSubject = {
  name: string;
  plan: ParsedPlanItem[];
  standards: ParsedStandard[];
  elements: ParsedElement[];
  warnings: string[];
};

export type ExtractedPlan = {
  subjects: ExtractedSubject[];
  warnings: string[];
  plainText: string;
};

const KNOWN_SUBJECTS = ["슬기로운 생활", "즐거운 생활", "바른 생활", "국어", "수학", "사회", "과학", "도덕", "영어", "음악", "미술", "체육", "실과"];

export const HWP_UNSUPPORTED =
  "예전 한글 파일(.hwp)은 이 브라우저에서 열 수 없습니다. 한글에서 ‘다른 이름으로 저장’을 눌러 HWPX나 PDF로 저장한 뒤 다시 올려 주세요.";

const MAX_BYTES = 15 * 1024 * 1024;

export function planFileKind(name: string): "hwpx" | "pdf" | "hwp" | "unknown" {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".hwpx")) return "hwpx";
  if (lower.endsWith(".hwp")) return "hwp";
  if (lower.endsWith(".pdf")) return "pdf";
  return "unknown";
}

export function blocksToPlain(blocks: DocBlock[]): string {
  return blocks
    .map((block) => (block.kind === "text" ? block.text : block.rows.map((row) => row.join("\t")).join("\n")))
    .filter((text) => text.trim())
    .join("\n\n");
}

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

export function matchSubjectHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return null;
  const labeled = trimmed.match(/^(?:과목|교과)\s*[:：]\s*(.+)$/);
  const source = labeled?.[1]?.trim() || trimmed;
  let folded = compact(source);
  folded = folded.replace(/^[0-9]+[.)]/, "");
  folded = folded.replace(/^[가나다라마바사아자차][.)]/, "");
  folded = folded.replace(/[■□●○▶▷☆★※【】[\]()（）]/g, "");
  folded = folded.replace(/20\d\d학년도?/g, "");
  folded = folded.replace(/[1-6]학년도?/g, "");
  folded = folded.replace(/[1-2]학기/g, "");
  folded = folded.replace(/평가계획서?/g, "");
  folded = folded.replace(/수행평가/g, "");
  folded = folded.replace(/성취기준/g, "");
  folded = folded.replace(/학습주제/g, "");
  folded = folded.replace(/^(과목|교과)/, "");
  if (!folded || folded.length > 16) return null;
  const known = [...KNOWN_SUBJECTS].sort((left, right) => compact(right).length - compact(left).length);
  for (const name of known) {
    const key = compact(name);
    if (folded === key || folded === `${key}과`) return name;
  }
  if (labeled) {
    const name = source.replace(/\s+/g, " ").trim();
    if (name.length > 0 && name.length <= 20) return name;
  }
  return null;
}

type HeaderMap = {
  area?: number;
  content?: number;
  method?: number;
  ratio?: number;
  note?: number;
  element?: number;
  unit?: number;
  subject?: number;
  standards?: number;
  standardText?: number;
  level?: number;
  criterion?: number;
  levels: Array<{ index: number; label: string }>;
  kind: "plan" | "elements" | "standards" | "both";
};

function levelLabel(header: string): string | null {
  const key = compact(header);
  if (!key || /성취기준|평가내용|영역|방법|비율|단원/.test(key)) return null;
  if (/잘함|보통|노력요함|미흡|우수|기초|도달|미도달/.test(key)) return header.trim();
  if (/^(상|중|하|A|B|C)$/.test(key)) return header.trim();
  return null;
}

function mapHeader(cells: string[]): HeaderMap | null {
  const map: HeaderMap = { levels: [], kind: "plan" };
  let hits = 0;
  cells.forEach((cell, index) => {
    const key = compact(cell);
    if (!key) return;
    if (key === "과목" || key === "교과") {
      map.subject = index;
      hits += 1;
      return;
    }
    if (/평가요소|요소명/.test(key) || key === "요소") {
      map.element = index;
      hits += 1;
      return;
    }
    if (key === "코드" || /성취기준코드/.test(key)) {
      if (map.standards !== undefined && map.standardText === undefined) map.standardText = map.standards;
      map.standards = index;
      hits += 1;
      return;
    }
    if (/성취기준/.test(key)) {
      if (map.standards !== undefined) map.standardText = index;
      else map.standards = index;
      hits += 1;
      return;
    }
    if (/^(단원|학습주제|주제)$/.test(key)) {
      map.unit = index;
      hits += 1;
      return;
    }
    if (/^(수준|수준명|등급)$/.test(key)) {
      map.level = index;
      hits += 1;
      return;
    }
    if (/기준$|설명/.test(key) && !/성취기준/.test(key)) {
      map.criterion = index;
      hits += 1;
      return;
    }
    const level = levelLabel(cell);
    if (level) {
      map.levels.push({ index, label: level });
      hits += 1;
      return;
    }
    if (/비율|배점|가중치|환산/.test(key)) {
      map.ratio = index;
      hits += 1;
      return;
    }
    if (/방법|유형/.test(key)) {
      map.method = index;
      hits += 1;
      return;
    }
    if (/영역/.test(key)) {
      map.area = index;
      hits += 1;
      return;
    }
    if (/내용|항목/.test(key) && map.content === undefined) {
      map.content = index;
      hits += 1;
      return;
    }
    if (/비고|메모|시기/.test(key)) {
      map.note = index;
      hits += 1;
    }
  });
  const elementLike = map.element !== undefined || map.levels.length >= 2 || (map.level !== undefined && map.criterion !== undefined);
  const planLike = (map.area !== undefined || map.content !== undefined) && (map.method !== undefined || map.ratio !== undefined);
  const standardLike = map.standards !== undefined && !elementLike && !planLike && map.levels.length === 0;
  if (!elementLike && !planLike && !standardLike) return null;
  if (hits < 2 && !standardLike) return null;
  if (elementLike && planLike) map.kind = "both";
  else if (elementLike) map.kind = "elements";
  else if (standardLike) map.kind = "standards";
  else map.kind = "plan";
  return map;
}

function cellAt(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return row[index]?.trim() ?? "";
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function singleCell(row: string[]): string | null {
  const filled = row.map((cell) => cell.trim()).filter(Boolean);
  return filled.length === 1 ? (filled[0] ?? null) : null;
}

type TablePick = {
  name: string;
  plan: ParsedPlanItem[];
  standards: ParsedStandard[];
  elements: ParsedElement[];
};

function rowSubjectName(row: string[], header: HeaderMap, carried: string): string {
  const labeled = matchSubjectHeading(cellAt(row, header.subject)) ?? "";
  const coded = findCodes(`${cellAt(row, header.standards)} ${cellAt(row, header.standardText)}`)
    .map((code) => subjectFromCode(code))
    .find((name): name is string => Boolean(name));
  if (labeled && !coded) return labeled;
  if (coded) return coded;
  if (labeled) return labeled;
  return carried;
}

function standardsFromRow(row: string[], header: HeaderMap): ParsedStandard[] {
  const codeCell = cellAt(row, header.standards);
  const textCell = cellAt(row, header.standardText);
  const source = textCell ? `${codeCell} ${textCell}` : codeCell;
  const parsed = parseStandards(source);
  if (parsed.items.length > 0) {
    return parsed.items.map((item) => ({ code: item.code, text: item.text || textCell }));
  }
  const codes = findCodes(source);
  return codes.map((code) => ({ code, text: textCell }));
}

function interpretTable(rows: string[][]): TablePick[] | null {
  const cleaned = rows.map((row) => row.map((cell) => cell.replace(/\u00a0/g, " ").trim()));
  let headerIndex = -1;
  let header: HeaderMap | null = null;
  for (let index = 0; index < Math.min(cleaned.length, 5); index += 1) {
    const mapped = mapHeader(cleaned[index] ?? []);
    if (mapped) {
      headerIndex = index;
      header = mapped;
      break;
    }
  }
  if (!header || headerIndex < 0) return null;
  const headerRow = cleaned[headerIndex] ?? [];
  const data = cleaned.slice(headerIndex + 1).filter((row) => {
    if (!row.some((cell) => cell.trim())) return false;
    const same = headerRow.every((cell, index) => compact(cell) === compact(row[index] ?? ""));
    return !same;
  });
  const groups = new Map<string, TablePick>();
  let carriedSubject = "";
  function groupFor(name: string): TablePick {
    const key = name || "";
    const found = groups.get(key);
    if (found) return found;
    const created: TablePick = { name: key, plan: [], standards: [], elements: [] };
    groups.set(key, created);
    return created;
  }

  if (header.kind === "standards") {
    for (const row of data) {
      carriedSubject = rowSubjectName(row, header, carriedSubject);
      groupFor(carriedSubject).standards.push(...standardsFromRow(row, header));
    }
    return groups.size > 0 ? [...groups.values()] : null;
  }

  if (header.level !== undefined && header.criterion !== undefined) {
    let current: ParsedElement | null = null;
    for (const row of data) {
      const only = singleCell(row);
      if (only && matchSubjectHeading(only)) continue;
      const name = tidy(cellAt(row, header.element ?? header.content));
      const unitTitle = tidy(cellAt(row, header.unit));
      const codes = findCodes(cellAt(row, header.standards));
      const label = tidy(cellAt(row, header.level));
      const description = tidy(cellAt(row, header.criterion));
      carriedSubject = rowSubjectName(row, header, carriedSubject);
      const bucket = groupFor(carriedSubject);
      if (name) {
        current = { name, unitTitle, standardCodes: codes, levels: [], note: tidy(cellAt(row, header.note)) };
        bucket.elements.push(current);
      } else if (!current) {
        continue;
      } else {
        if (unitTitle && !current.unitTitle) current.unitTitle = unitTitle;
        for (const code of codes) {
          if (!current.standardCodes.includes(code)) current.standardCodes.push(code);
        }
      }
      if ((label || description) && current) current.levels.push({ label, description });
      bucket.standards.push(...standardsFromRow(row, header));
    }
    return groups.size > 0 ? [...groups.values()] : null;
  }

  for (const row of data) {
    const only = singleCell(row);
    if (only && matchSubjectHeading(only)) continue;
    carriedSubject = rowSubjectName(row, header, carriedSubject);
    const bucket = groupFor(carriedSubject);
    if (header.kind === "plan" || header.kind === "both") {
      const item: ParsedPlanItem = {
        area: tidy(cellAt(row, header.area)),
        content: tidy(cellAt(row, header.content) || cellAt(row, header.element)),
        method: tidy(cellAt(row, header.method)),
        ratio: tidy(cellAt(row, header.ratio)),
        note: tidy(cellAt(row, header.note)),
      };
      if (item.area || item.content || item.method || item.ratio) bucket.plan.push(item);
    }
    if (header.kind === "elements" || header.kind === "both") {
      const name = tidy(cellAt(row, header.element) || cellAt(row, header.content));
      if (name) {
        const levels = header.levels
          .map((level) => ({ label: level.label, description: tidy(cellAt(row, level.index)) }))
          .filter((level) => level.description);
        bucket.elements.push({
          name,
          unitTitle: cleanUnitTitle(tidy(cellAt(row, header.unit))),
          standardCodes: findCodes(cellAt(row, header.standards)),
          levels,
          note: tidy(cellAt(row, header.note)),
        });
      }
    }
    bucket.standards.push(...standardsFromRow(row, header));
  }
  const picks = [...groups.values()].filter((group) => group.plan.length > 0 || group.standards.length > 0 || group.elements.length > 0);
  return picks.length > 0 ? picks : null;
}

function dedupePlan(items: ParsedPlanItem[]): ParsedPlanItem[] {
  const result: ParsedPlanItem[] = [];
  for (const item of items) {
    const key = [item.area, item.content, item.method].map(compact).join("|");
    const found = result.find((current) => [current.area, current.content, current.method].map(compact).join("|") === key);
    if (!found) {
      result.push({ ...item });
      continue;
    }
    if (!found.ratio && item.ratio) found.ratio = item.ratio;
    if (!found.note && item.note) found.note = item.note;
  }
  return result;
}

function dedupeStandards(items: ParsedStandard[]): ParsedStandard[] {
  const result: ParsedStandard[] = [];
  for (const item of items) {
    const code = item.code.trim();
    if (!code) continue;
    const found = result.find((current) => current.code === code);
    if (!found) {
      result.push({ code, text: item.text.trim() });
      continue;
    }
    if (item.text.trim().length > found.text.trim().length) found.text = item.text.trim();
  }
  return result;
}

function dedupeElements(items: ParsedElement[]): ParsedElement[] {
  const result: ParsedElement[] = [];
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const found = result.find((current) => compact(current.name) === compact(name));
    if (!found) {
      result.push({
        ...item,
        name,
        standardCodes: [...new Set(item.standardCodes)],
        levels: item.levels.filter((level) => level.label || level.description),
      });
      continue;
    }
    if (!found.unitTitle && item.unitTitle) found.unitTitle = item.unitTitle;
    for (const code of item.standardCodes) {
      if (!found.standardCodes.includes(code)) found.standardCodes.push(code);
    }
    for (const level of item.levels) {
      const existing = found.levels.find((current) => compact(current.label) === compact(level.label));
      if (!existing && (level.label || level.description)) found.levels.push(level);
      else if (existing && !existing.description && level.description) existing.description = level.description;
    }
    if (!found.note && item.note) found.note = item.note;
  }
  return result;
}

function warningsFor(subject: ExtractedSubject, skippedTables: number): string[] {
  const warnings: string[] = [];
  if (subject.plan.length === 0) warnings.push("평가계획 행을 찾지 못했습니다. 표 첫줄에 영역, 평가 내용, 방법, 반영 비율이 있는지 봐 주세요.");
  if (subject.standards.length === 0) warnings.push("성취기준 코드를 찾지 못했습니다. 예: [4국02-01]");
  if (subject.elements.length === 0) {
    warnings.push("평가요소를 찾지 못했습니다. 평가요소와 잘함·보통·노력요함, 또는 상·중·하 칸이 있는지 봐 주세요.");
  }
  const found = [subject.plan, subject.standards, subject.elements].filter((list) => list.length > 0).length;
  if (found === 0) warnings.unshift("이 부분에서 넣을 내용을 알아보지 못했습니다.");
  else if (found < 3) warnings.push("일부만 알아봤습니다. 빠진 칸은 미리보기에서 고치거나, 설정에 키가 있으면 AI로 정리를 사용해 보세요.");
  if (skippedTables > 0) warnings.push(`표 ${skippedTables}개는 머리글이 달라 평가계획으로 넣지 못했습니다.`);
  const missing = subject.standards.filter((item) => !item.text.trim()).map((item) => item.code);
  if (missing.length > 0) warnings.push(`성취기준 ${missing.slice(0, 4).join(", ")}의 문장을 찾지 못했습니다. 미리보기에서 채워 주세요.`);
  return warnings;
}

type Bucket = { name: string; blocks: DocBlock[] };

function splitSubjects(blocks: DocBlock[]): Bucket[] {
  const buckets: Bucket[] = [];
  let current: Bucket = { name: "", blocks: [] };
  function push() {
    if (current.blocks.length > 0 || current.name) buckets.push(current);
    current = { name: "", blocks: [] };
  }
  function start(name: string) {
    push();
    current = { name, blocks: [] };
  }
  for (const block of blocks) {
    if (block.kind === "text") {
      const lines = block.text.split(/\n/);
      const buffer: string[] = [];
      const flush = () => {
        const text = buffer.join("\n").trim();
        buffer.length = 0;
        if (text) current.blocks.push({ kind: "text", text });
      };
      for (const line of lines) {
        const heading = matchSubjectHeading(line);
        if (heading) {
          flush();
          start(heading);
          continue;
        }
        buffer.push(line);
      }
      flush();
      continue;
    }
    let slice: string[][] = [];
    const flushSlice = () => {
      if (slice.length > 0) current.blocks.push({ kind: "table", rows: slice });
      slice = [];
    };
    for (const row of block.rows) {
      const only = singleCell(row);
      const heading = only ? matchSubjectHeading(only) : null;
      if (heading) {
        flushSlice();
        start(heading);
        continue;
      }
      slice.push(row);
    }
    flushSlice();
  }
  push();
  return buckets.filter((bucket) => bucket.blocks.length > 0);
}

function extractBucket(bucket: Bucket): ExtractedSubject[] {
  const named = new Map<string, { plan: ParsedPlanItem[]; standards: ParsedStandard[]; elements: ParsedElement[] }>();
  const take = (name: string) => {
    const key = name || bucket.name;
    const found = named.get(key);
    if (found) return found;
    const created = { plan: [] as ParsedPlanItem[], standards: [] as ParsedStandard[], elements: [] as ParsedElement[] };
    named.set(key, created);
    return created;
  };
  const texts: string[] = [];
  let skippedTables = 0;
  for (const block of bucket.blocks) {
    if (block.kind === "text") {
      texts.push(block.text);
      continue;
    }
    const parsed = interpretTable(block.rows);
    if (!parsed) {
      const wide = block.rows.filter((row) => row.filter((cell) => cell.trim()).length > 1);
      if (wide.length > 1) skippedTables += 1;
      texts.push(block.rows.map((row) => row.join(" ")).join("\n"));
      continue;
    }
    for (const group of parsed) {
      const target = take(group.name || bucket.name);
      target.plan.push(...group.plan);
      target.standards.push(...group.standards);
      target.elements.push(...group.elements);
    }
  }
  const prose = texts.join("\n");
  for (const item of parseStandards(prose).items) take(subjectFromCode(item.code) || bucket.name).standards.push(item);
  if (/평가요소\s*[:：]|잘함\s*[:：]|노력요함\s*[:：]|상\s*[:：]/.test(prose)) {
    take(bucket.name).elements.push(...parseElements(prose).items);
  }
  if (named.size === 0) take(bucket.name);
  return [...named.entries()].map(([name, group]) => {
    const subject: ExtractedSubject = {
      name,
      plan: dedupePlan(group.plan),
      standards: dedupeStandards(group.standards),
      elements: dedupeElements(group.elements),
      warnings: [],
    };
    subject.warnings = warningsFor(subject, skippedTables);
    return subject;
  });
}

function mergeExtracted(items: ExtractedSubject[]): ExtractedSubject[] {
  const merged = new Map<string, ExtractedSubject>();
  for (const item of items) {
    const found = merged.get(item.name);
    if (!found) {
      merged.set(item.name, {
        name: item.name,
        plan: dedupePlan(item.plan),
        standards: dedupeStandards(item.standards),
        elements: dedupeElements(item.elements),
        warnings: [],
      });
      continue;
    }
    found.plan = dedupePlan([...found.plan, ...item.plan]);
    found.standards = dedupeStandards([...found.standards, ...item.standards]);
    found.elements = dedupeElements([...found.elements, ...item.elements]);
  }
  return [...merged.values()].map((subject) => {
    subject.warnings = warningsFor(subject, 0);
    return subject;
  });
}

export function planImportTarget(name: string, subjects: Array<{ id: string; name: string }>): string {
  const key = name.replace(/\s+/g, "");
  const found = subjects.find((subject) => subject.name.replace(/\s+/g, "") === key);
  if (found) return found.id;
  if (key) return "__create__";
  return "";
}

export function interpretPlan(blocks: DocBlock[], expectedCounts: Record<string, number> = {}): ExtractedPlan {
  const plainText = blocksToPlain(blocks);
  const letters = plainText.replace(/\s/g, "");
  const warnings: string[] = [];
  if (letters.length < 12) {
    warnings.push("글자가 거의 없습니다. 스캔한 그림 PDF는 읽지 못합니다. 한글에서 글자가 포함된 PDF나 HWPX로 저장해 주세요.");
  }
  const subjects = mergeExtracted(splitSubjects(blocks).flatMap(extractBucket)).filter(
    (subject) => subject.name || subject.plan.length > 0 || subject.standards.length > 0 || subject.elements.length > 0,
  );
  if (subjects.length === 0) {
    subjects.push({
      name: "",
      plan: [],
      standards: [],
      elements: [],
      warnings: warningsFor({ name: "", plan: [], standards: [], elements: [], warnings: [] }, 0),
    });
  }
  if (subjects.length > 1) warnings.push("과목이 여러 개로 보입니다. 과목마다 나눠 두었습니다. 맞는지 확인하고, 필요하면 넣을 과목을 바꾸세요.");
  const creating = subjects.filter((subject) => subject.name).map((subject) => subject.name);
  if (creating.length > 0) warnings.push(`문서에서 찾은 과목: ${creating.join(", ")}. 없는 과목은 넣기를 누르면 새로 만들어집니다.`);
  for (const [name, count] of Object.entries(expectedCounts)) {
    const subject = subjects.find((item) => item.name === name);
    const actual = subject?.plan.length ?? 0;
    if (count > 0 && actual !== count) {
      warnings.push(`${name} 평가 항목이 ${actual}개인데, 문서 하단에는 ${count}개라고 되어 있습니다. 쪽 경계에서 한 줄이 나뉘었는지 확인해 주세요.`);
    }
  }
  return { subjects, warnings, plainText };
}

export async function readPlanFile(name: string, bytes: Uint8Array): Promise<Result<ExtractedPlan>> {
  const kind = planFileKind(name);
  if (kind === "hwp") return { ok: false, error: HWP_UNSUPPORTED };
  if (kind === "unknown") return { ok: false, error: "HWPX 또는 PDF 파일을 올려 주세요." };
  if (bytes.byteLength === 0) return { ok: false, error: "파일이 비어 있습니다." };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, error: "파일이 너무 큽니다. 15MB보다 작은 문서를 올려 주세요." };
  if (kind === "pdf") {
    const { readPdfBlocks } = await import("./pdfRead");
    const blocks = await readPdfBlocks(bytes);
    if (!blocks.ok) return blocks;
    return { ok: true, data: interpretPlan(blocks.data.blocks, blocks.data.expectedCounts) };
  }
  const blocks = readHwpxBlocks(bytes);
  if (!blocks.ok) return blocks;
  return { ok: true, data: interpretPlan(blocks.data) };
}
