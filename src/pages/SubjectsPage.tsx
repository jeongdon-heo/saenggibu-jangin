import { ArrowDown, ArrowUp, Trash } from "lucide-react";
import { useState } from "react";
import { ElementsSection } from "../components/ElementsSection";
import { PlanImportSection } from "../components/PlanImportSection";
import { UnitsSection } from "../components/UnitsSection";
import { Button, cx, Field, Modal, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { subjectSuggestions } from "../lib/format";
import {
  addPlanItem,
  addPlanItems,
  addStandard,
  addSubject,
  deletePlanItem,
  deleteStandard,
  deleteSubject,
  mergeStandards,
  moveSubject,
  renameSubject,
  updatePlanItem,
  updateStandard,
} from "../lib/model";
import { canonicalCode, parsePlan, parseStandards } from "../lib/parse";
import type { Subject } from "../types";

export function SubjectsPage() {
  usePageTitle("평가계획·성취기준");
  const { data, apply } = useAppData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const subject = data.subjects.find((item) => item.id === selectedId) ?? data.subjects[0] ?? null;
  const suggestions = subjectSuggestions(data.classInfo.grade).filter(
    (item) => !data.subjects.some((current) => current.name === item),
  );

  function create(subjectName: string) {
    const result = addSubject(data, subjectName);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setName("");
    if (result.id) setSelectedId(result.id);
    apply(result.data);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="1단계 · 사용 가능"
        title="학습주제·성취기준"
        description="평가계획 HWPX·PDF를 이 브라우저에서 읽어 채우거나, 직접 적습니다. 진도표 순서의 학습주제를 평가요소와 연결합니다. 파일은 서버로 나가지 않습니다."
      />
      <PlanImportSection currentSubjectId={subject?.id ?? null} onApplied={(id) => id && setSelectedId(id)} />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <section>
          <form
            className="sheet p-4"
            onSubmit={(event) => {
              event.preventDefault();
              create(name);
            }}
          >
            <Field label="과목 추가" error={error}>
              <input className="control" value={name} maxLength={30} placeholder="예: 국어" onChange={(event) => setName(event.target.value)} />
            </Field>
            <Button type="submit" className="mt-3 w-full">
              추가
            </Button>
            {suggestions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button key={item} type="button" className="rounded-full bg-paper px-3 py-1 text-sm text-ink hover:bg-brand-soft" onClick={() => create(item)}>
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </form>
          {data.subjects.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted">등록된 과목이 없습니다.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {data.subjects.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cx(
                      "w-full rounded-2xl px-3 py-2 text-left text-sm",
                      subject?.id === item.id ? "bg-brand-soft font-medium text-brand" : "hover:bg-card",
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    {item.name}
                    <span className="mt-0.5 block text-xs font-normal text-muted">성취기준 {item.standards.length} · 평가요소 {item.elements.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {subject ? (
          <SubjectEditor key={subject.id} subject={subject} />
        ) : (
          <p className="sheet px-5 py-10 text-center text-sm text-muted">과목을 추가하면 여기에 평가계획과 성취기준을 적습니다.</p>
        )}
      </div>
    </div>
  );
}

function SubjectEditor({ subject }: { subject: Subject }) {
  const { data, apply } = useAppData();
  const [name, setName] = useState(subject.name);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const index = data.subjects.findIndex((item) => item.id === subject.id);

  return (
    <section className="space-y-6">
      <div className="sheet p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field label="과목 이름" error={error}>
              <input
                id={`subject-name-${subject.id}`}
                className="control"
                maxLength={30}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                onBlur={() => {
                  const result = renameSubject(data, subject.id, name);
                  if (!result.ok) {
                    setError(result.error);
                    setName(subject.name);
                    return;
                  }
                  setError(null);
                  apply(result.data);
                }}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" aria-label="위로" disabled={index <= 0} onClick={() => apply(moveSubject(data, subject.id, -1))}>
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="아래로"
              disabled={index === data.subjects.length - 1}
              onClick={() => apply(moveSubject(data, subject.id, 1))}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash className="size-4" aria-hidden />
              과목 삭제
            </Button>
          </div>
        </div>
      </div>

      <PlanEditor subject={subject} />
      <StandardsEditor subject={subject} />
      <UnitsSection subject={subject} />
      <ElementsSection subject={subject} />

      {confirmDelete ? (
        <Modal title="이 과목을 지울까요?" onClose={() => setConfirmDelete(false)}>
          <p>{subject.name}의 평가계획, 성취기준, 단원, 평가요소, 문제, 학생 문장이 함께 지워집니다.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                apply(deleteSubject(data, subject.id));
                setConfirmDelete(false);
              }}
            >
              삭제
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function PlanEditor({ subject }: { subject: Subject }) {
  const { data, apply } = useAppData();
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function pasteItems() {
    const parsed = parsePlan(paste);
    if (parsed.items.length === 0) {
      setMessage(parsed.warnings[0] ?? "평가 항목으로 나누지 못했습니다.");
      return;
    }
    const result = addPlanItems(data, subject.id, parsed.items);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setPaste("");
    setMessage(`평가 항목 ${result.added}개를 추가했습니다.`);
  }

  return (
    <section className="sheet p-5">
      <h2 className="text-lg font-bold">학교 평가계획</h2>
      <p className="mt-1 text-sm leading-6 text-muted">영역, 평가 내용, 방법, 반영 비율을 적어둡니다. 엑셀에서 복사해 붙여넣어도 됩니다.</p>
      <div className="mt-4 space-y-3">
        {subject.plan.length === 0 ? <p className="text-sm text-muted">아직 평가 항목이 없습니다.</p> : null}
        {subject.plan.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-line bg-paper/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-muted">항목 {index + 1}</p>
              <button type="button" className="text-sm text-danger" onClick={() => apply(deletePlanItem(data, subject.id, item.id))}>
                삭제
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="영역">
                <input className="control" value={item.area} onChange={(event) => {
                  const value = event.target.value;
                  apply((current) => updatePlanItem(current, subject.id, item.id, { area: value }));
                }} />
              </Field>
              <Field label="반영 비율">
                <input className="control" value={item.ratio} onChange={(event) => {
                  const value = event.target.value;
                  apply((current) => updatePlanItem(current, subject.id, item.id, { ratio: value }));
                }} />
              </Field>
              <Field label="평가 내용">
                <input className="control" value={item.content} onChange={(event) => {
                  const value = event.target.value;
                  apply((current) => updatePlanItem(current, subject.id, item.id, { content: value }));
                }} />
              </Field>
              <Field label="방법">
                <input className="control" value={item.method} onChange={(event) => {
                  const value = event.target.value;
                  apply((current) => updatePlanItem(current, subject.id, item.id, { method: value }));
                }} />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        className="mt-4"
        onClick={() => {
          const result = addPlanItem(data, subject.id);
          if (result.ok) apply(result.data);
          else setMessage(result.error);
        }}
      >
        항목 추가
      </Button>
      <details className="mt-4" open={subject.plan.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">표 붙여넣기</summary>
        <textarea
          className="control mt-3"
          rows={5}
          value={paste}
          placeholder={"영역\t평가 내용\t방법\t비율\n읽기\t중심 내용 파악\t관찰\t30%"}
          onChange={(event) => setPaste(event.target.value)}
        />
        <Button className="mt-3" onClick={pasteItems}>
          항목으로 넣기
        </Button>
      </details>
      {message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}
    </section>
  );
}

function StandardsEditor({ subject }: { subject: Subject }) {
  const { data, apply } = useAppData();
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const hint = canonicalCode(code) === null && code.trim().length > 0 ? "코드 형식이 달라 보여요. 예: 6국01-01. 그래도 저장할 수 있습니다." : null;

  function addOne() {
    const result = addStandard(data, subject.id, code, text);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setCode("");
    setText("");
    setMessage("성취기준을 추가했습니다.");
  }

  function pasteMany() {
    const parsed = parseStandards(paste);
    if (parsed.items.length === 0) {
      setMessage("성취기준 코드를 찾지 못했습니다. 예: [6국01-01] 내용");
      return;
    }
    const result = mergeStandards(data, subject.id, parsed.items);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    const unmatched = parsed.unmatched.length > 0 ? ` 알아보지 못한 줄 ${parsed.unmatched.length}개는 그대로 두었습니다.` : "";
    setMessage(`${result.added}개를 새로 넣었고, ${result.updated}개는 내용을 고쳤습니다.${unmatched}`);
    if (parsed.unmatched.length === 0) setPaste("");
  }

  return (
    <section className="sheet p-5">
      <h2 className="text-lg font-bold">성취기준</h2>
      <p className="mt-1 text-sm leading-6 text-muted">코드와 내용을 등록합니다. 예: [6국01-01] 내용. 학교 문서에서 복사해 주세요.</p>
      <div className="mt-4 space-y-3">
        {subject.standards.length === 0 ? <p className="text-sm text-muted">아직 성취기준이 없습니다.</p> : null}
        {subject.standards.map((standard) => (
          <div key={standard.id} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[9rem_1fr_auto]">
            <input
              className="control"
              aria-label="성취기준 코드"
              value={standard.code}
              onChange={(event) => {
                const value = event.target.value;
                apply((current) => {
                  const result = updateStandard(current, subject.id, standard.id, { code: value });
                  return result.ok ? result.data : current;
                });
              }}
            />
            <textarea
              className="control min-h-20"
              aria-label="성취기준 내용"
              rows={2}
              value={standard.text}
              onChange={(event) => {
                const value = event.target.value;
                apply((current) => {
                  const result = updateStandard(current, subject.id, standard.id, { text: value });
                  return result.ok ? result.data : current;
                });
              }}
            />
            <button type="button" className="text-sm text-danger sm:self-start" onClick={() => apply(deleteStandard(data, subject.id, standard.id))}>
              삭제
            </button>
          </div>
        ))}
      </div>

      <form
        className="mt-4 grid gap-3 rounded-2xl bg-paper/70 p-3 sm:grid-cols-[9rem_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          addOne();
        }}
      >
        <Field label="코드" hint={hint ?? undefined}>
          <input className="control" value={code} placeholder="6국01-01" onChange={(event) => setCode(event.target.value)} />
        </Field>
        <Field label="내용">
          <input className="control" value={text} placeholder="성취기준 내용" onChange={(event) => setText(event.target.value)} />
        </Field>
        <Button type="submit">추가</Button>
      </form>

      <details className="mt-4" open={subject.standards.length === 0}>
        <summary className="cursor-pointer text-sm font-medium">여러 개 붙여넣기</summary>
        <textarea
          className="control mt-3"
          rows={6}
          value={paste}
          placeholder={"[6국01-01] 성취기준 내용을 붙여넣으세요.\n[6국01-02] 한 줄에 하나씩 넣으면 코드와 내용으로 나뉩니다."}
          onChange={(event) => setPaste(event.target.value)}
        />
        <Button className="mt-3" onClick={pasteMany}>
          성취기준으로 넣기
        </Button>
      </details>
      {message ? <p className="mt-3 text-sm leading-6 text-brand">{message}</p> : null}
    </section>
  );
}
