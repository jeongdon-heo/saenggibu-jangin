import { useMemo, useState } from "react";
import { useAppData } from "../context/DataContext";
import { addUnits, applySkipSuggestions, deleteUnit, storeProgressLessons, updateUnit } from "../lib/curriculum";
import { suggestSkip } from "../lib/topics";
import { orderedTopics } from "../lib/teacherAssess";
import { parseProgressTable, type ParsedUnit } from "../lib/progressSheet";
import { readXlsxTable } from "../lib/xlsxRead";
import type { Subject } from "../types";
import { Button } from "./ui";

export function UnitsSection({ subject }: { subject: Subject }) {
  const { data, apply } = useAppData();
  const [rows, setRows] = useState<ParsedUnit[] | null>(null);
  const [onlyClass, setOnlyClass] = useState(true);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!rows) return [];
    return rows.filter((unit) => {
      if (!onlyClass) return true;
      const gradeOk = data.classInfo.grade === null || unit.grade === null || unit.grade === data.classInfo.grade;
      const semesterOk = unit.semester === null || unit.semester === data.classInfo.semester;
      return gradeOk && semesterOk;
    });
  }, [data.classInfo.grade, data.classInfo.semester, onlyClass, rows]);

  const groups = useMemo(() => {
    const map = new Map<string, ParsedUnit[]>();
    for (const unit of visible) {
      const key = unit.organization || "(편제 없음)";
      map.set(key, [...(map.get(key) ?? []), unit]);
    }
    return map;
  }, [visible]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    const table = readXlsxTable(new Uint8Array(await file.arrayBuffer()));
    if (!table.ok) {
      setRows(null);
      setMessage(table.error);
      return;
    }
    const parsed = parseProgressTable(table.data);
    if (!parsed.ok) {
      setRows(null);
      setMessage(parsed.error);
      return;
    }
    const nextMapping: Record<string, string> = {};
    for (const unit of parsed.data) {
      const key = unit.organization || "(편제 없음)";
      if (nextMapping[key] !== undefined) continue;
      const matched = data.subjects.find((item) => item.name === unit.organization);
      nextMapping[key] = matched?.id ?? (data.subjects.length === 1 ? data.subjects[0]?.id ?? "" : subject.id);
    }
    setMapping(nextMapping);
    setRows(parsed.data);
    setMessage(`단원 ${parsed.data.length}개를 읽었습니다. 넣을 과목을 확인하고 추가하세요.`);
  }

  function saveLessons() {
    if (!rows) return;
    const stored = storeProgressLessons(data, rows);
    if (stored.stored === 0) {
      setMessage("저장할 차시가 없습니다. 편제 이름이 과목 이름과 같은 행만 쪽수로 남깁니다.");
      return;
    }
    apply(stored.data);
    setRows(null);
    setMessage(`차시 ${stored.stored}개를 쪽수 자료로 저장했습니다. 평가 열은 그대로입니다.`);
  }

  function commit(mode: "append" | "replace") {
    let next = data;
    const replaced = new Set<string>();
    let count = 0;
    for (const [organization, subjectId] of Object.entries(mapping)) {
      if (!subjectId) continue;
      const units = groups.get(organization) ?? [];
      if (units.length === 0) continue;
      const useMode = mode === "replace" && !replaced.has(subjectId) ? "replace" : "append";
      replaced.add(subjectId);
      const result = addUnits(next, subjectId, units, useMode);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      next = result.data;
      count += units.length;
    }
    if (count === 0) {
      setMessage("넣을 단원이 없습니다. 편제마다 과목을 골라 주세요.");
      return;
    }
    apply(next);
    setRows(null);
    setMessage(`단원 ${count}개를 넣었습니다.`);
  }

  return (
    <section className="sheet p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">학습주제</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            나이스 진도표의 순번대로 나열합니다. 평가요소와 성취기준을 연결하고, 공개수업·학기말 총정리처럼 수업이 아닌 행은 건너뜁니다.
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={subject.units.length === 0} onClick={() => apply(applySkipSuggestions(data, subject.id))}>
          수업이 아닌 행 건너뛰기
        </Button>
      </div>
      {subject.units.length === 0 ? <p className="mt-3 text-sm text-muted">아직 학습주제가 없습니다. 진도표를 불러오세요.</p> : null}
      <ul className="mt-3 space-y-2">
        {orderedTopics(subject).map((unit) => {
          const element = subject.elements.find((item) => item.id === unit.elementId);
          const standards = element?.standardCodes
            .map((code) => subject.standards.find((standard) => standard.code === code))
            .filter((standard) => standard !== undefined) ?? [];
          return (
            <li key={unit.id} className={`rounded-2xl border border-line px-3 py-3 text-sm ${unit.skipped ? "bg-paper opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium">{unit.order}. {unit.title}</span>
                  {unit.content ? <span className="mt-0.5 block text-muted">{unit.content}</span> : null}
                  {suggestSkip(unit.title, unit.content) ? <span className="mt-1 inline-block rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">수업이 아닌 행으로 제안</span> : null}
                </span>
                <button type="button" className="shrink-0 text-danger" onClick={() => apply(deleteUnit(data, subject.id, unit.id))}>
                  삭제
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!unit.skipped}
                    onChange={(event) => apply(updateUnit(data, subject.id, unit.id, { skipped: !event.target.checked }))}
                  />
                  수업으로 평가
                </label>
                <select className="control h-9 sm:max-w-xs" value={unit.elementId} aria-label={`${unit.title} 평가요소`} onChange={(event) => apply(updateUnit(data, subject.id, unit.id, { elementId: event.target.value }))}>
                  <option value="">평가요소 연결</option>
                  {subject.elements.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              {standards.length > 0 ? <p className="mt-2 text-muted">{standards.map((standard) => `[${standard.code}] ${standard.text}`).join(" ")}</p> : null}
            </li>
          );
        })}
      </ul>
      <label className="mt-4 inline-flex h-11 cursor-pointer items-center rounded-2xl border border-line bg-white px-4 text-sm font-medium">
        진도표 엑셀 불러오기
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </label>
      {rows ? (
        <div className="mt-4 rounded-2xl bg-paper p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyClass} onChange={(event) => setOnlyClass(event.target.checked)} />
            이 학급의 학년·학기와 같은 행만
          </label>
          <div className="mt-3 space-y-2">
            {[...groups.entries()].map(([organization, units]) => (
              <div key={organization} className="grid gap-2 sm:grid-cols-[1fr_12rem] sm:items-center">
                <p className="text-sm">
                  <span className="font-medium">{organization}</span>
                  <span className="text-muted"> · {units.length}개</span>
                  <span className="mt-0.5 block text-muted">{units.slice(0, 2).map((unit) => unit.title).join(", ")}</span>
                </p>
                <select
                  className="control"
                  value={mapping[organization] ?? ""}
                  onChange={(event) => setMapping((current) => ({ ...current, [organization]: event.target.value }))}
                >
                  <option value="">넣지 않기</option>
                  {data.subjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={saveLessons}>차시 쪽수 저장</Button>
            <Button variant="secondary" onClick={() => commit("append")}>단원 추가</Button>
            <Button variant="secondary" onClick={() => commit("replace")}>
              기존 단원을 바꾸고 넣기
            </Button>
          </div>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm leading-6 text-brand">{message}</p> : null}
    </section>
  );
}
