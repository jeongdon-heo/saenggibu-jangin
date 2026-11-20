import { useState, type ReactNode } from "react";
import { useAppData } from "../context/DataContext";
import { completeAi } from "../lib/ai";
import { guardPrompt } from "../lib/guard";
import { createId } from "../lib/id";
import { applyPlanSelections, planApplyMessage, type PlanSelection } from "../lib/planApply";
import { planImportTarget, readPlanFile, type ExtractedPlan } from "../lib/planDocument";
import { PLAN_AI_SYSTEM, buildPlanPrompt, parsePlanAiResponse } from "../lib/planPrompt";
import { findCodes, type ParsedPlanItem, type ParsedStandard } from "../lib/parse";
import type { ParsedElement } from "../lib/elementsParse";
import type { Subject } from "../types";
import { Button } from "./ui";

type Checked<T> = { id: string; checked: boolean; value: T };

type DraftSubject = {
  id: string;
  detectedName: string;
  target: string;
  plan: Array<Checked<ParsedPlanItem>>;
  standards: Array<Checked<ParsedStandard>>;
  elements: Array<Checked<ParsedElement>>;
  warnings: string[];
};

function checkedItems<T>(items: T[]): Array<Checked<T>> {
  return items.map((value) => ({ id: createId(), checked: true, value }));
}

function initialTarget(name: string, subjects: Subject[], currentSubjectId: string | null): string {
  const targeted = planImportTarget(name, subjects);
  if (targeted) return targeted;
  if (currentSubjectId && subjects.some((subject) => subject.id === currentSubjectId)) return currentSubjectId;
  if (subjects.length === 1) return subjects[0]?.id ?? "";
  return "";
}

function draftFrom(plan: ExtractedPlan, subjects: Subject[], currentSubjectId: string | null): DraftSubject[] {
  return plan.subjects.map((subject) => ({
    id: createId(),
    detectedName: subject.name,
    target: initialTarget(subject.name, subjects, currentSubjectId),
    plan: checkedItems(subject.plan),
    standards: checkedItems(subject.standards),
    elements: checkedItems(subject.elements.map((item) => ({ ...item, levels: item.levels.map((level) => ({ ...level })) }))),
    warnings: subject.warnings,
  }));
}

function codesFromInput(value: string): string[] {
  const found = findCodes(value);
  if (found.length > 0) return found;
  return value
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function PlanImportSection({
  currentSubjectId,
  onApplied,
}: {
  currentSubjectId: string | null;
  onApplied?: (subjectId: string | null) => void;
}) {
  const { data, apply, aiKey } = useAppData();
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [plainText, setPlainText] = useState("");
  const [draft, setDraft] = useState<DraftSubject[] | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const prompt = plainText ? buildPlanPrompt(plainText) : null;

  function adopt(plan: ExtractedPlan) {
    setWarnings(plan.warnings);
    setPlainText(plan.plainText);
    setDraft(draftFrom(plan, data.subjects, currentSubjectId));
    setAiOpen(false);
    setMessage(null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setMessage(null);
    setReading(true);
    try {
      const result = await readPlanFile(file.name, new Uint8Array(await file.arrayBuffer()));
      if (!result.ok) {
        setDraft(null);
        setPlainText("");
        setWarnings([]);
        setError(result.error);
        setFileLabel(file.name);
        return;
      }
      setFileLabel(file.name);
      adopt(result.data);
    } finally {
      setReading(false);
    }
  }

  function updateSubject(id: string, mapper: (subject: DraftSubject) => DraftSubject) {
    setDraft((current) => current?.map((subject) => (subject.id === id ? mapper(subject) : subject)) ?? null);
  }

  function applyDraft() {
    if (!draft) return;
    const selections: PlanSelection[] = draft.map((subject) => ({
      subjectId: subject.target !== "__create__" ? subject.target : "",
      createName: subject.target === "__create__" ? subject.detectedName : "",
      plan: subject.plan.filter((item) => item.checked).map((item) => item.value),
      standards: subject.standards.filter((item) => item.checked).map((item) => item.value),
      elements: subject.elements.filter((item) => item.checked).map((item) => item.value),
    }));
    const before = new Set(data.subjects.map((subject) => subject.id));
    const result = applyPlanSelections(data, selections);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    apply(result.data);
    const created = result.data.subjects.filter((subject) => !before.has(subject.id));
    const chosen = selections.find((item) => item.subjectId)?.subjectId ?? created[0]?.id ?? null;
    onApplied?.(chosen);
    setDraft(null);
    setAiOpen(false);
    setError(null);
    const made = created.map((subject) => subject.name).filter(Boolean);
    setMessage(`${planApplyMessage(result)}${made.length > 0 ? ` 새 과목: ${made.join(", ")}.` : ""}`);
  }

  async function sendToAi() {
    if (!prompt) return;
    const guarded = guardPrompt(prompt.prompt, data);
    if (!guarded.ok) {
      setError(guarded.error);
      return;
    }
    if (!aiKey.trim()) {
      setError("API 키가 없습니다. 설정에서 본인 키를 넣은 뒤 다시 시도해 주세요.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const text = await completeAi({
        provider: data.aiSettings.provider,
        model: data.aiSettings.model,
        apiKey: aiKey,
        prompt: guarded.data,
        system: PLAN_AI_SYSTEM,
      });
      const parsed = parsePlanAiResponse(text);
      if ("error" in parsed) {
        setError(parsed.error);
        return;
      }
      adopt({
        subjects: parsed.subjects,
        warnings: ["AI가 정리한 결과입니다. 문서와 견주어 보고, 넣을 항목만 체크한 뒤 넣으세요."],
        plainText,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "인공지능 정리를 마치지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="sheet mb-6 p-5">
      <h2 className="text-lg font-bold">평가계획 문서</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        학교 평가계획 HWPX나 PDF를 올리면 이 브라우저 안에서만 읽습니다. 파일은 서버로 나가지 않습니다. 과목마다 나눠 보여 주고, 확인한 뒤에만 각 과목에 넣습니다.
      </p>
      <label className="mt-4 inline-flex h-11 cursor-pointer items-center rounded-2xl border border-line bg-white px-4 text-sm font-medium">
        {reading ? "읽는 중" : "HWPX·PDF 올리기"}
        <input
          type="file"
          accept=".hwpx,.pdf,.hwp,application/pdf"
          className="sr-only"
          disabled={reading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </label>
      {fileLabel ? <p className="mt-2 text-sm text-muted">{fileLabel}</p> : null}
      {error ? <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger">{error}</p> : null}
      {message ? <p className="mt-3 text-sm leading-6 text-brand">{message}</p> : null}
      {draft ? (
        <Review
          draft={draft}
          warnings={warnings}
          subjects={data.subjects}
          plainText={plainText}
          prompt={prompt?.prompt ?? ""}
          truncated={prompt?.truncated ?? false}
          aiKey={aiKey}
          aiOpen={aiOpen}
          sending={sending}
          onToggleAi={() => setAiOpen((open) => !open)}
          onSend={() => void sendToAi()}
          onChange={updateSubject}
          onApply={applyDraft}
          onClose={() => {
            setDraft(null);
            setAiOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function Review({
  draft,
  warnings,
  subjects,
  plainText,
  prompt,
  truncated,
  aiKey,
  aiOpen,
  sending,
  onToggleAi,
  onSend,
  onChange,
  onApply,
  onClose,
}: {
  draft: DraftSubject[];
  warnings: string[];
  subjects: Subject[];
  plainText: string;
  prompt: string;
  truncated: boolean;
  aiKey: string;
  aiOpen: boolean;
  sending: boolean;
  onToggleAi: () => void;
  onSend: () => void;
  onChange: (id: string, mapper: (subject: DraftSubject) => DraftSubject) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-paper p-4">
      <h3 className="text-base font-bold">읽어 온 내용 확인</h3>
      <p className="mt-1 text-sm leading-6 text-muted">
        과목별로 나눠 두었습니다. 체크를 끄면 그 항목은 넣지 않습니다. 오른쪽에서 넣을 과목을 바꾸거나 넣지 않기를 고를 수 있습니다. 이미 있는 성취기준과 평가요소는 겹치면 다시 만들지 않습니다.
      </p>
      {draft.some((subject) => subject.target === "__create__" && subject.detectedName) ? (
        <p className="mt-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm leading-6 text-warn">
          없는 과목은 넣기를 누르면 새로 만듭니다:{" "}
          {draft
            .filter((subject) => subject.target === "__create__" && subject.detectedName)
            .map((subject) => subject.detectedName)
            .join(", ")}
          . 등록된 과목이 없어도 과목마다 들어갑니다.
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 rounded-2xl bg-warn-soft px-4 py-3 text-sm leading-6 text-warn">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 space-y-4">
        {draft.map((subject) => (
          <SubjectReview key={subject.id} subject={subject} subjects={subjects} onChange={(mapper) => onChange(subject.id, mapper)} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onApply}>선택한 항목 넣기</Button>
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
        {aiKey.trim() && plainText.trim() ? (
          <Button variant="secondary" onClick={onToggleAi}>
            AI로 정리
          </Button>
        ) : null}
      </div>
      {!aiKey.trim() ? (
        <p className="mt-3 text-sm leading-6 text-muted">규칙으로 다 나누지 못했다면 설정에서 본인 AI 키를 넣은 뒤 ‘AI로 정리’를 쓸 수 있습니다. 키가 없으면 문서는 이 브라우저 밖에 나가지 않습니다.</p>
      ) : null}
      {aiOpen && prompt ? (
        <div className="mt-4 rounded-2xl border border-line bg-card p-3">
          <p className="text-sm leading-6">
            아래 글만 선생님의 AI 키로 보내집니다. 학생 번호, 별칭, 실명, 답안이 들어 있으면 보내지 않습니다.
            {truncated ? " 문서가 길어 앞부분만 포함했습니다." : ""}
          </p>
          <textarea className="control mt-3" readOnly rows={8} value={prompt} aria-label="AI로 보낼 내용" />
          <Button className="mt-3" disabled={sending} onClick={onSend}>
            {sending ? "정리하는 중" : "이대로 보내기"}
          </Button>
        </div>
      ) : null}
      {plainText.trim() ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">읽어 낸 글 보기</summary>
          <textarea className="control mt-3" readOnly rows={6} value={plainText.slice(0, 4000)} aria-label="문서에서 읽어 낸 글" />
        </details>
      ) : null}
    </div>
  );
}

function SubjectReview({
  subject,
  subjects,
  onChange,
}: {
  subject: DraftSubject;
  subjects: Subject[];
  onChange: (mapper: (subject: DraftSubject) => DraftSubject) => void;
}) {
  const items = [...subject.plan, ...subject.standards, ...subject.elements];
  const allOn = items.length > 0 && items.every((item) => item.checked);
  const canCreate =
    subject.detectedName.length > 0 && !subjects.some((item) => item.name.replace(/\s+/g, "") === subject.detectedName.replace(/\s+/g, ""));

  return (
    <section className="rounded-2xl border border-line bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem] sm:items-center">
        <p className="text-sm">
          <span className="font-medium">{subject.detectedName || "과목 표시 없음"}</span>
          <span className="text-muted">
            {" "}
            · 평가 {subject.plan.length} · 성취기준 {subject.standards.length} · 평가요소 {subject.elements.length}
          </span>
        </p>
        <select
          className="control"
          aria-label={`${subject.detectedName || "이 문서"}를 넣을 과목`}
          value={subject.target}
          onChange={(event) => onChange((current) => ({ ...current, target: event.target.value }))}
        >
          <option value="">넣지 않기</option>
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
          {canCreate ? <option value="__create__">{subject.detectedName} 과목 만들기</option> : null}
        </select>
      </div>
      {subject.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-warn">
          {subject.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {items.length > 0 ? (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allOn}
            onChange={(event) => {
              const checked = event.target.checked;
              onChange((current) => ({
                ...current,
                plan: current.plan.map((item) => ({ ...item, checked })),
                standards: current.standards.map((item) => ({ ...item, checked })),
                elements: current.elements.map((item) => ({ ...item, checked })),
              }));
            }}
          />
          이 과목 항목 모두
        </label>
      ) : (
        <p className="mt-2 text-sm text-muted">알아본 항목이 없습니다.</p>
      )}
      <ItemList
        title="평가계획"
        items={subject.plan}
        onToggle={(id, checked) => onChange((current) => ({ ...current, plan: current.plan.map((item) => (item.id === id ? { ...item, checked } : item)) }))}
        render={(item) => (
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="control" aria-label="영역" value={item.value.area} onChange={(event) => patchPlan(item.id, { area: event.target.value })} />
            <input className="control" aria-label="반영 비율" value={item.value.ratio} onChange={(event) => patchPlan(item.id, { ratio: event.target.value })} />
            <input className="control" aria-label="평가 내용" value={item.value.content} onChange={(event) => patchPlan(item.id, { content: event.target.value })} />
            <input className="control" aria-label="방법" value={item.value.method} onChange={(event) => patchPlan(item.id, { method: event.target.value })} />
            {item.value.note ? (
              <input className="control sm:col-span-2" aria-label="시기" value={item.value.note} onChange={(event) => patchPlan(item.id, { note: event.target.value })} />
            ) : null}
          </div>
        )}
      />
      <ItemList
        title="성취기준"
        items={subject.standards}
        onToggle={(id, checked) =>
          onChange((current) => ({ ...current, standards: current.standards.map((item) => (item.id === id ? { ...item, checked } : item)) }))
        }
        render={(item) => (
          <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
            <input className="control" aria-label="성취기준 코드" value={item.value.code} onChange={(event) => patchStandard(item.id, { code: event.target.value })} />
            <input className="control" aria-label="성취기준 내용" value={item.value.text} onChange={(event) => patchStandard(item.id, { text: event.target.value })} />
          </div>
        )}
      />
      <ItemList
        title="평가요소"
        items={subject.elements}
        onToggle={(id, checked) =>
          onChange((current) => ({ ...current, elements: current.elements.map((item) => (item.id === id ? { ...item, checked } : item)) }))
        }
        render={(item) => (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="control" aria-label="평가요소 이름" value={item.value.name} onChange={(event) => patchElement(item.id, { name: event.target.value })} />
              <input className="control" aria-label="단원" value={item.value.unitTitle} onChange={(event) => patchElement(item.id, { unitTitle: event.target.value })} />
            </div>
            <input
              className="control"
              aria-label="연결된 성취기준"
              value={item.value.standardCodes.join(", ")}
              onChange={(event) => patchElement(item.id, { standardCodes: codesFromInput(event.target.value) })}
            />
            {item.value.levels.map((level, index) => (
              <div key={`${item.id}-${index}`} className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                <input className="control" aria-label="수준 이름" value={level.label} onChange={(event) => patchLevel(item.id, index, { label: event.target.value })} />
                <input
                  className="control"
                  aria-label="수준 설명"
                  value={level.description}
                  onChange={(event) => patchLevel(item.id, index, { description: event.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      />
    </section>
  );

  function patchPlan(id: string, patch: Partial<ParsedPlanItem>) {
    onChange((current) => ({
      ...current,
      plan: current.plan.map((item) => (item.id === id ? { ...item, value: { ...item.value, ...patch } } : item)),
    }));
  }

  function patchStandard(id: string, patch: Partial<ParsedStandard>) {
    onChange((current) => ({
      ...current,
      standards: current.standards.map((item) => (item.id === id ? { ...item, value: { ...item.value, ...patch } } : item)),
    }));
  }

  function patchElement(id: string, patch: Partial<ParsedElement>) {
    onChange((current) => ({
      ...current,
      elements: current.elements.map((item) => (item.id === id ? { ...item, value: { ...item.value, ...patch } } : item)),
    }));
  }

  function patchLevel(id: string, index: number, patch: Partial<{ label: string; description: string }>) {
    onChange((current) => ({
      ...current,
      elements: current.elements.map((item) =>
        item.id === id
          ? { ...item, value: { ...item.value, levels: item.value.levels.map((level, levelIndex) => (levelIndex === index ? { ...level, ...patch } : level)) } }
          : item,
      ),
    }));
  }
}

function ItemList<T>({
  title,
  items,
  onToggle,
  render,
}: {
  title: string;
  items: Array<Checked<T>>;
  onToggle: (id: string, checked: boolean) => void;
  render: (item: Checked<T>) => ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-sm font-bold">{title}</h4>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line p-2">
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={item.checked} onChange={(event) => onToggle(item.id, event.target.checked)} />
              넣기
            </label>
            {render(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}
