import { useState } from "react";
import { useAppData } from "../context/DataContext";
import { addElements, deleteElement, updateElement } from "../lib/curriculum";
import { parseElements } from "../lib/elementsParse";
import { createId } from "../lib/id";
import type { EvaluationElement, Subject } from "../types";
import { Button, Field } from "./ui";

const PRESETS = [
  ["상", "중", "하"],
  ["잘함", "보통", "노력요함"],
];

export function ElementsSection({ subject }: { subject: Subject }) {
  const { data, apply } = useAppData();
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function save(elementId: string, patch: Parameters<typeof updateElement>[3]) {
    apply((current) => {
      const result = updateElement(current, subject.id, elementId, patch);
      return result.ok ? result.data : current;
    });
  }

  function pasteElements() {
    const parsed = parseElements(paste);
    if (parsed.items.length === 0) {
      setMessage(parsed.warnings[0] ?? "평가요소를 나누지 못했습니다.");
      return;
    }
    const result = addElements(data, subject.id, parsed.items);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setPaste("");
    setMessage(`평가요소 ${result.added}개를 넣었습니다.`);
  }

  return (
    <section className="sheet p-5">
      <h2 className="text-lg font-bold">평가요소와 수준</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        수행평가의 평가요소를 적고, 연결된 성취기준과 수준별 기준을 붙입니다. 수준 이름은 학교마다 달라도 됩니다.
      </p>
      <div className="mt-4 space-y-3">
        {subject.elements.length === 0 ? <p className="text-sm text-muted">아직 평가요소가 없습니다.</p> : null}
        {subject.elements.map((element) => (
          <ElementCard key={element.id} subject={subject} element={element} onChange={(patch) => save(element.id, patch)} onDelete={() => apply(deleteElement(data, subject.id, element.id))} />
        ))}
      </div>
      <Button
        variant="secondary"
        className="mt-4"
        onClick={() => {
          const result = addElements(data, subject.id, [{ name: "새 평가요소", unitTitle: "", standardCodes: [], levels: [], note: "" }]);
          if (!result.ok) setMessage(result.error);
          else apply(result.data);
        }}
      >
        평가요소 추가
      </Button>
      <details className="mt-4" open={subject.elements.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">여러 개 붙여넣기</summary>
        <textarea
          className="control mt-3"
          rows={7}
          value={paste}
          placeholder={"평가요소: 중심 내용 파악\n단원: 2. 이야기를 간추려요\n성취기준: 4국02-01\n잘함: 중심 내용을 자신의 말로 설명한다.\n보통: 일부를 말한다.\n노력요함: 찾기 어려워한다."}
          onChange={(event) => setPaste(event.target.value)}
        />
        <Button className="mt-3" onClick={pasteElements}>
          평가요소로 넣기
        </Button>
      </details>
      {message ? <p className="mt-3 text-sm leading-6 text-brand">{message}</p> : null}
    </section>
  );
}

function ElementCard({
  subject,
  element,
  onChange,
  onDelete,
}: {
  subject: Subject;
  element: EvaluationElement;
  onChange: (patch: Parameters<typeof updateElement>[3]) => void;
  onDelete: () => void;
}) {
  function setLevels(levels: EvaluationElement["levels"]) {
    onChange({ levels });
  }

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Field label="평가요소">
          <input className="control" value={element.name} onChange={(event) => onChange({ name: event.target.value })} />
        </Field>
        <Field label="단원">
          <select className="control" value={element.unitId} onChange={(event) => onChange({ unitId: event.target.value })}>
            <option value="">단원 없음</option>
            {subject.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {element.note ? (
        <div className="mt-3">
          <Field label="메모">
            <input className="control" value={element.note} onChange={(event) => onChange({ note: event.target.value })} />
          </Field>
        </div>
      ) : null}
      <fieldset className="mt-3">
        <legend className="text-sm font-medium">연결된 성취기준</legend>
        {subject.standards.length === 0 ? <p className="mt-1 text-sm text-muted">성취기준을 먼저 등록해 주세요.</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {subject.standards.map((standard) => {
            const checked = element.standardCodes.includes(standard.code);
            return (
              <label key={standard.id} className="flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const standardCodes = checked
                      ? element.standardCodes.filter((code) => code !== standard.code)
                      : [...element.standardCodes, standard.code];
                    onChange({ standardCodes });
                  }}
                />
                {standard.code}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">수준별 기준</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((labels) => (
              <button
                key={labels.join("-")}
                type="button"
                className="rounded-full bg-paper px-3 py-1 text-xs"
                onClick={() => {
                  const levels = [...element.levels];
                  for (const label of labels) {
                    if (!levels.some((level) => level.label === label)) levels.push({ id: createId(), label, description: "" });
                  }
                  setLevels(levels);
                }}
              >
                {labels.join("·")} 넣기
              </button>
            ))}
          </div>
        </div>
        {element.levels.map((level) => (
          <div key={level.id} className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
            <input
              className="control"
              aria-label="수준 이름"
              value={level.label}
              onChange={(event) => setLevels(element.levels.map((item) => (item.id === level.id ? { ...item, label: event.target.value } : item)))}
            />
            <input
              className="control"
              aria-label="수준 설명"
              value={level.description}
              onChange={(event) => setLevels(element.levels.map((item) => (item.id === level.id ? { ...item, description: event.target.value } : item)))}
            />
            <button type="button" className="text-sm text-danger" onClick={() => setLevels(element.levels.filter((item) => item.id !== level.id))}>
              삭제
            </button>
          </div>
        ))}
        <button type="button" className="text-sm text-brand" onClick={() => setLevels([...element.levels, { id: createId(), label: "", description: "" }])}>
          수준 추가
        </button>
      </div>
      <button type="button" className="mt-3 text-sm text-danger" onClick={onDelete}>
        이 평가요소 삭제
      </button>
    </div>
  );
}
