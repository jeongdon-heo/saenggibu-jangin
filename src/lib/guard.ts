import type { AppData, Result } from "../types";

export type RosterLeak = {
  kind: "별칭" | "실명" | "번호" | "메모" | "문장";
  text: string;
};

function addLeak(hits: RosterLeak[], seen: Set<string>, kind: RosterLeak["kind"], text: string, prompt: string) {
  const needle = text.trim();
  const minimum = kind === "번호" ? 2 : 2;
  if (needle.length < minimum) return;
  const key = `${kind}:${needle}`;
  if (seen.has(key)) return;
  if (kind === "번호") {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`(?<!\\d)${escaped}`).test(prompt)) return;
  } else if (!prompt.includes(needle)) {
    return;
  }
  seen.add(key);
  hits.push({ kind, text: needle });
}

export function findRosterLeaks(prompt: string, data: AppData): RosterLeak[] {
  const hits: RosterLeak[] = [];
  const seen = new Set<string>();
  for (const student of data.students) {
    addLeak(hits, seen, "별칭", student.alias, prompt);
    addLeak(hits, seen, "실명", student.realName, prompt);
    addLeak(hits, seen, "번호", `${student.number}번`, prompt);
  }
  for (const record of data.records) {
    if (record.notes.trim().length >= 12) addLeak(hits, seen, "메모", record.notes, prompt);
    if (record.draft.trim().length >= 12) addLeak(hits, seen, "문장", record.draft, prompt);
  }
  return hits;
}

export function guardPrompt(prompt: string, data: AppData): Result<string> {
  const hits = findRosterLeaks(prompt, data);
  if (hits.length === 0) return { ok: true, data: prompt };
  const shown = hits
    .slice(0, 5)
    .map((hit) => `${hit.kind} ‘${hit.text}’`)
    .join(", ");
  return {
    ok: false,
    error: `학생 정보가 섞여 있어 보내지 않았습니다. ${shown}이 들어 있습니다. 평가요소, 성취기준, 단원 내용에 번호·별칭·실명·메모·문장이 들어갔는지 확인해 주세요.`,
  };
}
