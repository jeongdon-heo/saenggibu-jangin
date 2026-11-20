export type ParsedStudent = {
  number: number;
  alias: string;
  realName: string;
};

export type ParsedPlanItem = {
  area: string;
  content: string;
  method: string;
  ratio: string;
  note: string;
};

export type ParsedStandard = {
  code: string;
  text: string;
};

function softenSpaces(text: string): string {
  return text.replace(/[\u00a0\u3000]/g, " ");
}

function isHeaderLine(line: string): boolean {
  if (/^\d+\b/.test(line)) return false;
  return /번호|성명|이름|이니셜|별칭|학생/.test(line.replace(/\s/g, ""));
}

export function parseStudentList(text: string): { rows: ParsedStudent[]; errors: string[] } {
  const rows: ParsedStudent[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();
  const lines = softenSpaces(text).split(/\r?\n/);

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line || isHeaderLine(line)) return;
    const lineNo = index + 1;
    let parts: string[];
    if (line.includes("\t") || line.includes(",")) {
      const separator = line.includes("\t") ? "\t" : ",";
      parts = line.split(separator).map((part) => part.trim());
      while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
    } else {
      const matched = line.match(/^(\d+)\s*[.)번]?\s*(.*)$/);
      if (!matched) {
        errors.push(`${lineNo}번째 줄은 번호로 시작하지 않습니다.`);
        return;
      }
      parts = [matched[1], matched[2].trim()].filter((part) => part.length > 0);
    }

    const number = Number(parts[0]?.replace(/번$/, ""));
    if (!Number.isInteger(number) || number < 1 || number > 200) {
      errors.push(`${lineNo}번째 줄의 번호를 읽지 못했습니다.`);
      return;
    }
    if (seen.has(number)) {
      errors.push(`${number}번이 두 번 나옵니다.`);
      return;
    }
    seen.add(number);
    const alias = parts[1] ?? "";
    const realName = parts[2] ?? "";
    if (alias.length > 40 || realName.length > 40) {
      errors.push(`${lineNo}번째 줄이 너무 깁니다. 별칭은 짧게 적어 주세요.`);
      return;
    }
    rows.push({ number, alias, realName });
  });

  return { rows, errors };
}

const CODE_PATTERN = /\[?\s*([1-6])\s*([가-힣]{1,8})\s*(\d{2})\s*[-–—]\s*(\d{2})\s*\]?/g;

export function findCodes(text: string): string[] {
  const source = softenSpaces(text).replace(/［/g, "[").replace(/］/g, "]");
  CODE_PATTERN.lastIndex = 0;
  const codes: string[] = [];
  for (const match of source.matchAll(CODE_PATTERN)) {
    codes.push(`${match[1]}${match[2]}${match[3]}-${match[4]}`);
  }
  CODE_PATTERN.lastIndex = 0;
  return [...new Set(codes)];
}

export function canonicalCode(raw: string): string | null {
  const source = softenSpaces(raw).trim().replace(/［/g, "[").replace(/］/g, "]");
  const matched = source.match(/^\[?\s*([1-6])\s*([가-힣]{1,8})\s*(\d{2})\s*[-–—]\s*(\d{2})\s*\]?$/);
  if (!matched) return null;
  return `${matched[1]}${matched[2]}${matched[3]}-${matched[4]}`;
}

export function parseStandards(text: string): { items: ParsedStandard[]; unmatched: string[] } {
  const items: ParsedStandard[] = [];
  const unmatched: string[] = [];
  const lines = softenSpaces(text).replace(/［/g, "[").replace(/］/g, "]").split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const matches = [...line.matchAll(CODE_PATTERN)];
    if (matches.length === 0) {
      unmatched.push(line);
      continue;
    }
    matches.forEach((match, index) => {
      const code = `${match[1]}${match[2]}${match[3]}-${match[4]}`;
      const start = (match.index ?? 0) + match[0].length;
      const end = index + 1 < matches.length ? (matches[index + 1]?.index ?? line.length) : line.length;
      const body = line
        .slice(start, end)
        .trim()
        .replace(/^[\s:：.)\-–—\]]+/, "")
        .trim();
      items.push({ code, text: body });
    });
  }

  return { items, unmatched };
}

function splitColumns(line: string): string[] | null {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  if (line.includes("|")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    return cells;
  }
  return null;
}

function headerIndexes(cells: string[]): Partial<Record<keyof ParsedPlanItem, number>> | null {
  const map: Partial<Record<keyof ParsedPlanItem, number>> = {};
  cells.forEach((cell, index) => {
    const compact = cell.replace(/\s/g, "");
    if (!compact) return;
    if (/영역|단원/.test(compact) && map.area === undefined) map.area = index;
    else if (/방법/.test(compact) && map.method === undefined) map.method = index;
    else if (/비율|반영|배점/.test(compact) && map.ratio === undefined) map.ratio = index;
    else if (/비고|메모/.test(compact) && map.note === undefined) map.note = index;
    else if (/내용|항목|요소/.test(compact) && map.content === undefined) map.content = index;
  });
  return Object.keys(map).length >= 2 ? map : null;
}

function cellAt(cells: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return cells[index]?.trim() ?? "";
}

function columnsToItem(cells: string[]): ParsedPlanItem {
  const filled = cells.map((cell) => cell.trim());
  return {
    area: filled[0] ?? "",
    content: filled[1] ?? "",
    method: filled[2] ?? "",
    ratio: filled[3] ?? "",
    note: filled.slice(4).filter(Boolean).join(" "),
  };
}

function hasContent(item: ParsedPlanItem): boolean {
  return Boolean(item.area || item.content || item.method || item.ratio || item.note);
}

export function parsePlan(text: string): { items: ParsedPlanItem[]; warnings: string[] } {
  const lines = softenSpaces(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { items: [], warnings: ["붙여넣은 내용이 비어 있습니다."] };

  const firstCells = splitColumns(lines[0] ?? "");
  const header = firstCells ? headerIndexes(firstCells) : null;
  const source = header ? lines.slice(1) : lines;
  const items: ParsedPlanItem[] = [];

  for (const line of source) {
    const cells = splitColumns(line);
    if (cells && header) {
      const item: ParsedPlanItem = {
        area: cellAt(cells, header.area),
        content: cellAt(cells, header.content),
        method: cellAt(cells, header.method),
        ratio: cellAt(cells, header.ratio),
        note: cellAt(cells, header.note),
      };
      if (hasContent(item)) items.push(item);
      continue;
    }
    if (cells) {
      const item = columnsToItem(cells);
      if (hasContent(item)) items.push(item);
      continue;
    }
    const content = line.replace(/^\d+[.)]\s*/, "").trim();
    if (content) items.push({ area: "", content, method: "", ratio: "", note: "" });
  }

  if (items.length === 0) return { items, warnings: ["평가 항목으로 나누지 못했습니다."] };
  return { items, warnings: [] };
}
