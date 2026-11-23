import { useState } from "react";
import { Link } from "react-router-dom";
import { AiReviewNote } from "../components/AiReviewNote";
import { useToast } from "../components/Toast";
import { Button, cx, Modal, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { completeAi } from "../lib/ai";
import { copyText } from "../lib/copyText";
import {
  addParsedQuestions,
  deleteQuestion,
  moveQuestion,
  promptForElements,
  questionsFor,
  replaceQuestionContent,
  singleQuestionCounts,
  updateQuestion,
} from "../lib/curriculum";
import { guardPrompt } from "../lib/guard";
import { parseQuestionPaste, QUESTION_PASTE_EXAMPLE } from "../lib/questionParse";
import { rememberSubject, rememberedSubject } from "../lib/subjectChoice";
import { QUESTION_TYPES, questionTypeLabel } from "../lib/questionTypes";
import type { Question, QuestionTypeId } from "../types";

const EMPTY_COUNTS: Record<QuestionTypeId, number> = { choice: 2, short: 1, essay: 0, check: 0 };

export function QuestionsPage() {
  usePageTitle("문제 만들기");
  const { data, apply, aiKey } = useAppData();
  const toast = useToast();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [pickedBySubject, setPickedBySubject] = useState<Record<string, string[]>>({});
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [error, setError] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const subject =
    data.subjects.find((item) => item.id === subjectId) ??
    data.subjects.find((item) => item.id === rememberedSubject(data.subjects.map((entry) => entry.id))) ??
    data.subjects[0] ??
    null;

  const picked = subject ? pickedBySubject[subject.id] ?? subject.elements.map((element) => element.id) : [];
  function setPicked(next: string[] | ((current: string[]) => string[])) {
    if (!subject) return;
    const subjectIdNow = subject.id;
    const defaults = subject.elements.map((element) => element.id);
    setPickedBySubject((current) => {
      const previous = current[subjectIdNow] ?? defaults;
      return { ...current, [subjectIdNow]: typeof next === "function" ? next(previous) : next };
    });
  }

  const chosenIds = subject ? picked.filter((id) => subject.elements.some((element) => element.id === id)) : [];
  const promptIds = subject && chosenIds.length === 0 ? subject.elements.map((element) => element.id) : chosenIds;
  const promptResult = subject
    ? promptForElements(
        data,
        subject.id,
        promptIds,
        QUESTION_TYPES.map((item) => ({ type: item.id, count: counts[item.id] })),
      )
    : null;
  const questions = subject ? questionsFor(data, subject.id) : [];

  async function generate(target?: Question) {
    if (!subject) return;
    const linkedId = target ? target.elementId || subject.elements.find((element) => element.name === target.elementName)?.id || "" : "";
    const elementIds = target ? [linkedId].filter(Boolean) : promptIds;
    if (target && elementIds.length === 0) {
      setError("이 문제에 연결된 평가요소가 없습니다. 평가요소를 고른 뒤 다시 만들어 주세요.");
      return;
    }
    const requestCounts = target ? singleQuestionCounts(target.type) : QUESTION_TYPES.map((item) => ({ type: item.id, count: counts[item.id] }));
    const built = promptForElements(data, subject.id, elementIds, requestCounts);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    const guarded = guardPrompt(built.data, data);
    if (!guarded.ok) {
      setError(guarded.error);
      return;
    }
    if (!aiKey.trim()) {
      setError("API 키가 없습니다. AI 설정에서 키를 넣거나, 프롬프트 복사를 사용하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const text = await completeAi({
        provider: data.aiSettings.provider,
        model: data.aiSettings.model,
        apiKey: aiKey,
        prompt: guarded.data,
      });
      const parsed = parseQuestionPaste(text);
      if (!parsed.ok) {
        setPaste(text);
        setPasteOpen(true);
        setError(`${parsed.error} 받은 내용을 아래 칸에서 고친 뒤 넣을 수 있습니다.`);
        return;
      }
      const first = parsed.data[0];
      if (target && first) apply(replaceQuestionContent(data, target.id, first));
      else {
        const added = addParsedQuestions(data, subject.id, parsed.data, fallbackElementId());
        if (!added.ok) setError(added.error);
        else apply(added.data);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "문제를 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    if (!promptResult?.ok) {
      setError(promptResult?.ok === false ? promptResult.error : "보낼 내용을 만들지 못했습니다.");
      return;
    }
    const guarded = guardPrompt(promptResult.data, data);
    if (!guarded.ok) {
      setError(guarded.error);
      return;
    }
    const copied = await copyText(guarded.data);
    if (copied) toast("프롬프트를 복사했습니다. ChatGPT나 Gemini에 붙여넣으세요.");
    else setError("복사하지 못했습니다. 아래 보낼 내용에서 직접 선택해 주세요.");
  }

  function fallbackElementId() {
    if (!subject) return "";
    return picked.find((id) => subject.elements.some((element) => element.id === id)) ?? subject.elements[0]?.id ?? "";
  }

  function importPaste() {
    if (!subject) return;
    if (!paste.trim()) {
      setPasteError("붙여넣은 내용이 비어 있습니다. 아래 예시처럼 JSON을 넣어 주세요.");
      return;
    }
    const parsed = parseQuestionPaste(paste);
    if (!parsed.ok) {
      setPasteError(parsed.error);
      return;
    }
    const added = addParsedQuestions(data, subject.id, parsed.data, fallbackElementId());
    if (!added.ok) {
      setError(added.error);
      return;
    }
    apply(added.data);
    setPaste("");
    setPasteOpen(false);
    setPasteError(null);
    setError(null);
    toast(`문제 ${parsed.data.length}개를 초안으로 넣었습니다.`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="3단계 · 사용 가능"
        title="학생 자기평가 문제"
        description="학생 설문으로 수준을 가늠하는 문제입니다. 교사 평가와는 별개입니다. 학년, 과목, 단원, 성취기준, 수준별 기준만 인공지능에 보냅니다."
        actions={
          <>
            <Link to="/select" className="inline-flex h-11 items-center rounded-2xl bg-brand px-4 text-sm font-medium text-white">
              설문에 넣을 문제
            </Link>
            <Link to="/settings" className="inline-flex h-11 items-center rounded-2xl border border-line bg-card px-4 text-sm font-medium">
              AI 설정
            </Link>
          </>
        }
      />
      <AiReviewNote />
      {!subject ? (
        <p className="sheet mt-4 px-5 py-8 text-sm text-muted">
          과목을 먼저 등록해 주세요. <Link to="/subjects" className="text-brand">평가계획·성취기준</Link>
        </p>
      ) : (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {data.subjects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx("shrink-0 rounded-full px-4 py-2 text-sm", item.id === subject.id ? "bg-stage1 font-medium text-white" : "bg-card ring-1 ring-line")}
                onClick={() => {
                  rememberSubject(item.id);
                  setSubjectId(item.id);
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
          {subject.elements.length === 0 ? (
            <p className="sheet mt-4 px-5 py-8 text-sm leading-6 text-muted">
              평가요소와 수준별 기준이 없습니다. <Link to="/subjects" className="text-brand">과목 화면</Link>에서 먼저 등록해 주세요.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="sheet p-4">
                <h2 className="font-bold">평가요소</h2>
                <ul className="mt-3 space-y-2">
                  {subject.elements.map((element) => (
                    <li key={element.id}>
                      <label className="flex items-start gap-2 rounded-2xl bg-paper px-3 py-2 text-sm">
                        <input
                          className="mt-1"
                          type="checkbox"
                          checked={picked.includes(element.id)}
                          onChange={() => setPicked((current) => (current.includes(element.id) ? current.filter((id) => id !== element.id) : [...current, element.id]))}
                        />
                        <span>
                          <span className="font-medium">{element.name}</span>
                          <span className="mt-0.5 block text-muted">
                            {element.levels.map((level) => level.label).filter(Boolean).join(" · ") || "수준 없음"}
                            {element.standardCodes.length > 0 ? ` · ${element.standardCodes.join(", ")}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="sheet p-4">
                <h2 className="font-bold">유형과 개수</h2>
                <div className="mt-3 space-y-2">
                  {QUESTION_TYPES.map((item) => (
                    <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <span className="font-medium">{item.label}</span>
                        <span className="block text-muted">{item.hint}</span>
                      </span>
                      <input
                        className="control w-20"
                        inputMode="numeric"
                        aria-label={`${item.label} 개수`}
                        value={counts[item.id]}
                        onChange={(event) => {
                          const count = Number(event.target.value.replace(/[^\d]/g, "") || "0");
                          setCounts((current) => ({ ...current, [item.id]: Math.min(10, count) }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void generate()}>
                    {busy ? "만드는 중" : "문제 만들기"}
                  </Button>
                  <Button variant="secondary" onClick={() => void copyPrompt()}>
                    AI 없이 프롬프트 복사
                  </Button>
                  <Button variant="secondary" onClick={() => setPasteOpen(true)}>
                    결과 붙여넣기
                  </Button>
                </div>
                {!aiKey.trim() ? <p className="mt-3 text-sm leading-6 text-muted">키가 없어도 프롬프트를 복사해 ChatGPT나 Gemini에 넣을 수 있습니다.</p> : null}
                <p className="mt-3 text-sm leading-6 text-muted">지금 고른 과목은 {subject.name}입니다. 붙여넣는 JSON 예시는 다음과 같습니다.</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-paper p-3 text-xs leading-5">{QUESTION_PASTE_EXAMPLE}</pre>
              </section>
            </div>
          )}
          {error ? <p className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger">{error}</p> : null}
          {promptResult?.ok ? <PromptPreview prompt={promptResult.data} /> : null}
          <section className="mt-6">
            <h2 className="text-lg font-bold">만든 문제</h2>
            <p className="mt-1 text-sm text-muted">확정한 문제는 구글 폼 배포로 넘어갑니다. 설문에 넣을 문제에서 다시 고를 수 있습니다.</p>
            {questions.length === 0 ? <p className="mt-3 text-sm text-muted">아직 문제가 없습니다.</p> : null}
            <ul className="mt-3 space-y-3">
              {questions.map((question) => (
                <QuestionCard key={question.id} question={question} subjectId={subject.id} busy={busy} onRegenerate={() => void generate(question)} />
              ))}
            </ul>
          </section>
        </>
      )}
      {pasteOpen ? (
        <Modal title="만든 문제 붙여넣기" onClose={() => setPasteOpen(false)}>
          <p className="text-sm leading-6 text-muted">ChatGPT나 Gemini 답에서 JSON을 그대로 붙여넣으세요. 코드 블록이 있어도 됩니다. question, text, stem, prompt, choices, options, answer, type 이름도 받습니다.</p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-paper p-3 text-xs leading-5">{QUESTION_PASTE_EXAMPLE}</pre>
          <textarea className="control mt-3" rows={10} aria-label="문제 JSON" value={paste} onChange={(event) => setPaste(event.target.value)} />
          {pasteError ? <p className="mt-3 text-sm leading-6 text-danger">{pasteError}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPasteOpen(false)}>
              닫기
            </Button>
            <Button onClick={importPaste}>초안으로 넣기</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function PromptPreview({ prompt }: { prompt: string }) {
  const { data } = useAppData();
  const guarded = guardPrompt(prompt, data);
  return (
    <details className="sheet mt-4 p-4">
      <summary className="cursor-pointer text-sm font-medium">보낼 내용 보기</summary>
      {guarded.ok ? (
        <p className="mt-3 text-sm text-muted">학생 번호, 별칭, 실명, 메모, 문장은 들어 있지 않습니다.</p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-danger">{guarded.error}</p>
      )}
      <textarea className="control mt-3" readOnly rows={8} value={prompt} />
    </details>
  );
}

function QuestionCard({ question, subjectId, busy, onRegenerate }: { question: Question; subjectId: string; busy: boolean; onRegenerate: () => void }) {
  const { data, apply } = useAppData();
  const subject = data.subjects.find((item) => item.id === subjectId);
  function change(patch: Partial<Question>) {
    apply((current) => updateQuestion(current, question.id, patch));
  }
  return (
    <li className="sheet p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-stage1-soft px-2 py-1 font-medium text-stage1">{questionTypeLabel(question.type)}</span>
        <label className="text-muted">
          평가요소
          <select
            className="control ml-2 h-8 max-w-48 text-xs"
            aria-label="평가요소"
            value={question.elementId}
            onChange={(event) => {
              const element = subject?.elements.find((item) => item.id === event.target.value);
              change({
                elementId: element?.id ?? "",
                elementName: element?.name ?? "",
                standardCodes: element ? element.standardCodes : question.standardCodes,
              });
            }}
          >
            <option value="">평가요소 미정</option>
            {subject?.elements.map((element) => (
              <option key={element.id} value={element.id}>
                {element.name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-muted">{question.standardCodes.join(", ")}</span>
        <span className={question.approved ? "font-medium text-stage2" : "text-muted"}>{question.approved ? "확정" : "초안"}</span>
      </div>
      <label className="mt-3 block text-sm font-medium">
        문제
        <textarea className="control mt-1" rows={3} value={question.prompt} onChange={(event) => change({ prompt: event.target.value })} />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          목표 수준
          <input className="control mt-1" value={question.targetLevel} onChange={(event) => change({ targetLevel: event.target.value })} />
        </label>
        <label className="text-sm font-medium">
          유형
          <select className="control mt-1" value={question.type} onChange={(event) => change({ type: event.target.value as QuestionTypeId })}>
            {QUESTION_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {question.type === "choice" || question.type === "check" ? (
        <label className="mt-3 block text-sm font-medium">
          {question.type === "choice" ? "보기 (한 줄에 하나)" : "체크 항목 (한 줄에 하나)"}
          <textarea className="control mt-1" rows={4} value={question.choices.join("\n")} onChange={(event) => change({ choices: event.target.value.split("\n") })} />
        </label>
      ) : null}
      <label className="mt-3 block text-sm font-medium">
        정답 또는 예시 답안
        <textarea className="control mt-1" rows={2} value={question.answer} onChange={(event) => change({ answer: event.target.value })} />
      </label>
      <label className="mt-3 block text-sm font-medium">
        채점 기준
        <textarea className="control mt-1" rows={2} value={question.rubric} onChange={(event) => change({ rubric: event.target.value })} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={question.approved ? "secondary" : "primary"} onClick={() => change({ approved: !question.approved, selected: !question.approved })}>
          {question.approved ? "확정 취소" : "확정"}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={onRegenerate}>
          이 문제 다시 만들기
        </Button>
        <Button size="sm" variant="secondary" onClick={() => apply(moveQuestion(data, question.id, -1))}>
          위로
        </Button>
        <Button size="sm" variant="secondary" onClick={() => apply(moveQuestion(data, question.id, 1))}>
          아래로
        </Button>
        <Button size="sm" variant="danger" onClick={() => apply(deleteQuestion(data, question.id))}>
          삭제
        </Button>
      </div>
    </li>
  );
}
