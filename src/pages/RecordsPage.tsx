import { ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CountMeta } from "../components/CountMeta";
import { countLabel } from "../lib/textCount";
import { useToast } from "../components/Toast";
import { Button, cx, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { copyText } from "../lib/copyText";
import { checkComment, findNearDuplicates } from "../lib/commentCheck";
import { CommentActions } from "../components/CommentActions";
import { findRecord, sortedStudents, upsertRecord } from "../lib/model";
import { shownLevel } from "../lib/survey";
import type { Student, Subject } from "../types";

export function RecordsPage() {
  usePageTitle("평어 작성");
  const { data } = useAppData();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const subject = data.subjects.find((item) => item.id === subjectId) ?? data.subjects[0] ?? null;
  const students = sortedStudents(data.students);
  const subjectKey = subject?.id ?? null;
  const [openedFor, setOpenedFor] = useState<string | null>(subjectKey);
  if (subjectKey !== openedFor) {
    setOpenedFor(subjectKey);
    setExpandedId(students[0]?.id ?? null);
  }

  if (!subject || students.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="6단계 · 사용 가능"
          title="평어 작성"
          description="추정 수준과 선생님 메모로 성취수준 및 특기사항 초안을 만듭니다. 학생 답은 넣지 않습니다."
        />
        <div className="sheet px-5 py-8 text-sm leading-7 text-muted">
          {students.length === 0 ? <p>학생 명단이 없습니다.</p> : null}
          {!subject ? <p>과목이 없습니다.</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/class" className="inline-flex h-11 items-center rounded-2xl bg-brand px-4 font-medium text-white">
              학급 설정
            </Link>
            <Link to="/subjects" className="inline-flex h-11 items-center rounded-2xl border border-line bg-card px-4 font-medium">
              과목 등록
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const visible = students.filter((student) => {
    if (!onlyEmpty) return true;
    return (findRecord(data, student.id, subject.id)?.draft ?? "").trim().length === 0;
  });
  const done = students.filter((student) => (findRecord(data, student.id, subject.id)?.draft ?? "").trim().length > 0).length;

  const similar = new Set(
    findNearDuplicates(students.map((student) => ({ id: student.id, text: findRecord(data, student.id, subject.id)?.draft ?? "" }))).flatMap((hit) => [hit.a, hit.b]),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="6단계 · 사용 가능"
        title="평어 작성"
        description="추정 수준과 선생님 메모로 초안을 만듭니다. 확인하고 고친 문장만 나이스 복사와 엑셀에 들어갑니다."
        actions={
          <Link to="/neis" className="inline-flex h-11 items-center rounded-2xl border border-line bg-card px-4 text-sm font-medium">
            확인한 문장 내보내기
          </Link>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-2">
        {data.subjects.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx(
              "shrink-0 rounded-full px-4 py-2 text-sm",
              item.id === subject.id ? "bg-stage3 font-medium text-white" : "bg-card text-ink ring-1 ring-line",
            )}
            onClick={() => setSubjectId(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {subject.name} 문장을 적은 학생 <strong className="text-ink">{done}</strong> / {students.length}
        </p>
        <div className="flex gap-2">
          <FilterButton active={!onlyEmpty} onClick={() => setOnlyEmpty(false)}>
            전체
          </FilterButton>
          <FilterButton active={onlyEmpty} onClick={() => setOnlyEmpty(true)}>
            문장 없는 학생
          </FilterButton>
        </div>
      </div>

      <CommentActions subjectId={subject.id} studentIds={students.map((student) => student.id)} field="draft" />

      <details className="sheet mt-4 p-4">
        <summary className="cursor-pointer text-sm font-medium">이 과목 성취기준과 평가계획</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold">성취기준</h2>
            {subject.standards.length === 0 ? (
              <p className="mt-1 text-sm text-muted">
                아직 없습니다. <Link to="/subjects" className="text-brand">등록하기</Link>
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm leading-6">
                {subject.standards.map((standard) => (
                  <li key={standard.id}>
                    <span className="font-medium text-brand">[{standard.code}]</span> {standard.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold">평가계획</h2>
            {subject.plan.length === 0 ? (
              <p className="mt-1 text-sm text-muted">아직 없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm leading-6">
                {subject.plan.map((item) => (
                  <li key={item.id}>
                    {[item.area, item.content, item.method, item.ratio].filter(Boolean).join(" · ") || "빈 항목"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>

      {visible.length === 0 ? (
        <p className="sheet mt-4 px-5 py-8 text-center text-sm text-muted">이 과목은 모든 학생의 문장이 있습니다.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              subject={subject}
              open={expandedId === student.id}
              similar={similar.has(student.id)}
              onToggle={() => setExpandedId((current) => (current === student.id ? null : student.id))}
            />
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm leading-6 text-muted">
        확인 완료 전 초안은 엑셀과 복사에서 빠집니다. 나이스 문장으로 다듬으려면 <Link className="text-brand" to="/observe">관찰기록</Link>으로 가세요.
      </p>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      className={cx("rounded-full px-3 py-1.5 text-sm", active ? "bg-ink text-white" : "bg-card text-ink ring-1 ring-line")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StudentCard({
  student,
  subject,
  open,
  similar,
  onToggle,
}: {
  student: Student;
  subject: Subject;
  open: boolean;
  similar: boolean;
  onToggle: () => void;
}) {
  const { data, apply } = useAppData();
  const toast = useToast();
  const record = findRecord(data, student.id, subject.id);
  const notes = record?.notes ?? "";
  const draft = record?.draft ?? "";
  const confirmed = record?.draftConfirmed ?? false;
  const answers = data.responses.filter((response) => response.studentId === student.id).flatMap((response) => response.answers.map((answer) => answer.raw));
  const flags = checkComment(draft, { answers, standardTexts: subject.standards.map((standard) => standard.text) });
  const levels = subject.elements
    .map((element) => {
      const estimate = data.levelEstimates.find((item) => item.studentId === student.id && item.elementId === element.id);
      return estimate ? `${element.name} ${shownLevel(estimate) || "수준 없음"}` : "";
    })
    .filter(Boolean);

  async function copyDraft() {
    if (!confirmed) return;
    const ok = await copyText(draft);
    toast(ok ? "확인한 문장을 복사했습니다." : "복사하지 못했습니다.");
  }

  function write(patch: { notes?: string; draft?: string; draftConfirmed?: boolean }) {
    const incoming = patch.draft ?? patch.notes ?? "";
    if (incoming.length > 20000) toast("2만 자까지만 저장합니다.");
    apply((current) => upsertRecord(current, student.id, subject.id, patch).data);
  }

  return (
    <li className="sheet overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onToggle} aria-expanded={open}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stage3-soft text-sm font-bold text-stage3 tabular-nums">
            {student.number}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{student.alias || "별칭 없음"}</span>
            <span className="block text-sm text-muted">
              {countLabel(draft)}
              {confirmed ? " · 확인 완료" : ""}
            </span>
          </span>
          <ChevronDown className={cx("ml-auto size-4 shrink-0 text-muted transition", open && "rotate-180")} aria-hidden />
        </button>
        <Button variant="secondary" size="sm" disabled={!confirmed} onClick={() => void copyDraft()}>
          <Copy className="size-4" aria-hidden />
          문장 복사
        </Button>
      </div>
      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">관찰 메모</span>
            <span className="mb-2 block text-sm leading-6 text-muted">나만 보는 메모입니다. 나이스 복사와 엑셀에는 들어가지 않습니다.</span>
            <textarea className="control" rows={3} value={notes} onChange={(event) => write({ notes: event.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">성취수준 및 특기사항</span>
            <span className="mb-2 block text-sm leading-6 text-muted">나이스에 옮겨 적을 문장입니다.</span>
            <textarea className="control" rows={6} value={draft} onChange={(event) => write({ draft: event.target.value })} />
          </label>
          {levels.length > 0 ? <p className="text-sm text-muted">근거: {levels.join(" · ")}. 학생 답은 보여 주지 않습니다.</p> : null}
          {similar ? <p className="text-sm leading-6 text-warn">다른 학생 문장과 표현이 비슷합니다. 첫 문장이나 순서를 바꿔 주세요.</p> : null}
          {flags.map((flag) => (
            <p key={flag.message} className="text-sm leading-6 text-warn">
              {flag.message} {flag.suggestion}
            </p>
          ))}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <CountMeta text={draft} />
            <div className="flex gap-2">
              <Button variant={confirmed ? "secondary" : "primary"} disabled={!draft.trim()} onClick={() => write({ draftConfirmed: !confirmed })}>
                {confirmed ? "확인 취소" : "확인 완료"}
              </Button>
              <Button disabled={!confirmed} onClick={() => void copyDraft()}>
                <Copy className="size-4" aria-hidden />
                문장 복사
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
