import { canonicalCode } from "./parse";

export type ParsedElement = {
  name: string;
  unitTitle: string;
  standardCodes: string[];
  levels: Array<{ label: string; description: string }>;
  note: string;
};

const RESERVED = new Set(["평가요소", "요소", "단원", "성취기준", "성취기준코드", "비고", "메모"]);

function codesFrom(value: string): string[] {
  const found = value.match(/[1-6]\s*[가-힣]{1,8}\s*\d{2}\s*[-–—]\s*\d{2}/g) ?? [];
  const codes = found
    .map((item) => canonicalCode(item) ?? item.replace(/\s/g, "").replace(/[–—]/g, "-"))
    .filter(Boolean);
  return [...new Set(codes)];
}

function emptyElement(): ParsedElement {
  return { name: "", unitTitle: "", standardCodes: [], levels: [], note: "" };
}

function applyLine(element: ParsedElement, label: string, value: string) {
  const key = label.replace(/\s/g, "");
  if (key === "평가요소" || key === "요소") element.name = value;
  else if (key === "단원") element.unitTitle = value;
  else if (key === "성취기준" || key === "성취기준코드") element.standardCodes.push(...codesFrom(value));
  else if (key === "비고" || key === "메모") element.note = value;
  else if (label && value) element.levels.push({ label: label.trim(), description: value });
}

function parseBlock(block: string): ParsedElement | null {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const element = emptyElement();
  for (const line of lines) {
    const matched = line.match(/^([^:：]{1,20})\s*[:：]\s*(.*)$/);
    if (!matched) {
      if (!element.name) element.name = line;
      continue;
    }
    applyLine(element, matched[1] ?? "", (matched[2] ?? "").trim());
  }
  element.standardCodes = [...new Set(element.standardCodes)];
  if (!element.name) return null;
  return element;
}

function parseTable(lines: string[]): ParsedElement[] | null {
  const header = lines[0]?.split("\t").map((cell) => cell.trim()) ?? [];
  if (!header.some((cell) => /평가요소|요소/.test(cell.replace(/\s/g, "")))) return null;
  const keys = header.map((cell) => cell.replace(/\s/g, ""));
  const items: ParsedElement[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split("\t").map((cell) => cell.trim());
    const element = emptyElement();
    keys.forEach((key, index) => {
      const value = cells[index] ?? "";
      if (!value) return;
      if (key === "평가요소" || key === "요소") element.name = value;
      else if (key === "단원") element.unitTitle = value;
      else if (key === "성취기준" || key === "성취기준코드") element.standardCodes.push(...codesFrom(value));
      else if (!RESERVED.has(key)) element.levels.push({ label: header[index] ?? key, description: value });
    });
    if (element.name) items.push({ ...element, standardCodes: [...new Set(element.standardCodes)] });
  }
  return items;
}

export function parseElements(text: string): { items: ParsedElement[]; warnings: string[] } {
  const source = text.replace(/\u3000/g, " ").trim();
  if (!source) return { items: [], warnings: ["붙여넣은 내용이 비어 있습니다."] };
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => line.includes("\t"))) {
    const table = parseTable(lines.filter((line) => line.includes("\t") || /평가요소|요소/.test(line)));
    if (table && table.length > 0) return { items: table, warnings: [] };
  }
  const blocks = source.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const items = blocks.map(parseBlock).filter((item): item is ParsedElement => item !== null);
  if (items.length === 0) return { items: [], warnings: ["평가요소를 나누지 못했습니다. ‘평가요소: 이름’으로 시작해 보세요."] };
  return { items, warnings: [] };
}
