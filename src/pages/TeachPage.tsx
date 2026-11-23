import { memo, useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { cx, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { updateUnit } from "../lib/curriculum";
import { pageHint, type PageHint } from "../lib/textbookPages";
import { usePageTitle } from "../hooks/usePageTitle";
import { sortedStudents } from "../lib/model";
import { rememberSubject, rememberedSubject } from "../lib/subjectChoice";
import { bulkSetColumn, EVIDENCE_LABEL, findCheck, lessonTopics, levelLabels, toggleEvidence, topicStandards, upsertTeacherCheck } from "../lib/teacherAssess";
import type { EvidenceKind, Student, TeacherCheck, Unit } from "../types";

type TeachColumn = {
  topic: Unit;
  labels: string[];
  standards: Array<{ code: string; text: string }>;
  hint: PageHint | null;
  elementName: string;
};

const KINDS: EvidenceKind[] = ["observe", "paper", "performance"];
const KIND_KEY: Record<string, EvidenceKind> = { q: "observe", w: "paper", e: "performance" };
const studentColumnClass = "sticky left-0 z-20 box-border w-28 min-w-28 max-w-28 whitespace-nowrap bg-[#f3f0e8] px-2 py-2 text-left font-medium shadow-[4px_0_0_#f3f0e8]";

export function shortcutCell(target: EventTarget | null): { studentId: string; unitId: string } | null {
  if (!(target instanceof HTMLElement)) return null;
  const cell = target.closest("td[data-student-id]");
  if (!cell) return null;
  const studentId = cell.getAttribute("data-student-id") ?? "";
  const unitId = cell.getAttribute("data-unit-id") ?? "";
  return studentId && unitId ? { studentId, unitId } : null;
}

export function TeachPage() {
  usePageTitle("교사 평가");
  const { data, apply } = useAppData();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ studentId: string; unitId: string } | null>(null);
  const subject =
    data.subjects.find((item) => item.id === subjectId) ??
    data.subjects.find((item) => item.id === rememberedSubject(data.subjects.map((entry) => entry.id))) ??
    data.subjects[0] ??
    null;
  const students = useMemo(() => sortedStudents(data.students), [data.students]);
  const columns = useMemo<TeachColumn[]>(() => {
    if (!subject) return [];
    return lessonTopics(subject).map((topic) => ({
      topic,
      labels: levelLabels(subject, topic),
      standards: topicStandards(subject, topic),
      hint: pageHint(subject, topic),
      elementName: subject.elements.find((element) => element.id === topic.elementId)?.name || "평가요소 없음",
    }));
  }, [subject]);
  const checks = useMemo(() => {
    const index = new Map<string, TeacherCheck>();
    for (const check of data.teacherChecks) index.set(`${check.studentId}:${check.unitId}`, check);
    return index;
  }, [data.teacherChecks]);
  const topics = useMemo(() => columns.map((column) => column.topic), [columns]);
  const setLevel = useCallback((studentId: string, unitId: string, level: string) => {
    apply((current) => {
      const owner = current.subjects.find((item) => item.units.some((unit) => unit.id === unitId));
      if (!owner) return current;
      const check = findCheck(current, studentId, unitId);
      return upsertTeacherCheck(current, studentId, owner.id, unitId, { level: check?.level === level ? "" : level });
    });
  }, [apply]);
  const setEvidence = useCallback((studentId: string, unitId: string, kind: EvidenceKind) => {
    apply((current) => {
      const owner = current.subjects.find((item) => item.units.some((unit) => unit.id === unitId));
      if (!owner) return current;
      const check = findCheck(current, studentId, unitId);
      return upsertTeacherCheck(current, studentId, owner.id, unitId, { evidences: toggleEvidence(check?.evidences ?? [], kind) });
    });
  }, [apply]);
  const setNote = useCallback((studentId: string, unitId: string, note: string) => {
    apply((current) => {
      const owner = current.subjects.find((item) => item.units.some((unit) => unit.id === unitId));
      if (!owner) return current;
      return upsertTeacherCheck(current, studentId, owner.id, unitId, { note });
    });
  }, [apply]);
  const savePages = useCallback((unitId: string, pages: string) => {
    apply((current) => {
      const owner = current.subjects.find((item) => item.units.some((unit) => unit.id === unitId));
      if (!owner) return current;
      return updateUnit(current, owner.id, unitId, { chosenPages: pages.trim() });
    });
  }, [apply]);
  const setColumnLevel = useCallback((unitId: string, level: string) => {
    apply((current) => {
      const owner = current.subjects.find((item) => item.units.some((unit) => unit.id === unitId));
      if (!owner) return current;
      return bulkSetColumn(current, owner.id, unitId, level);
    });
  }, [apply]);

  function move(row: number, column: number) {
    const student = students[row];
    const topic = topics[column];
    if (!student || !topic) return;
    setFocus({ studentId: student.id, unitId: topic.id });
  }

  function onKey(event: KeyboardEvent) {
    if (!subject) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (target instanceof HTMLElement && target.closest("thead")) return;
    const located = shortcutCell(target);
    const current = located ?? focus;
    if (!current) return;
    if (located) setFocus(located);
    const row = students.findIndex((student) => student.id === current.studentId);
    const column = topics.findIndex((topic) => topic.id === current.unitId);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(row, column + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(row, column - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(row + 1, column);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(row - 1, column);
    } else if (event.key === "1" || event.key === "2" || event.key === "3") {
      const topic = topics[column];
      const level = topic ? levelLabels(subject, topic)[Number(event.key) - 1] : "";
      if (!topic || !level) return;
      event.preventDefault();
      apply(upsertTeacherCheck(data, current.studentId, subject.id, topic.id, { level }));
    } else if (KIND_KEY[event.key]) {
      const topic = topics[column];
      const kind = KIND_KEY[event.key];
      if (!topic || !kind) return;
      event.preventDefault();
      const check = findCheck(data, current.studentId, topic.id);
      apply(upsertTeacherCheck(data, current.studentId, subject.id, topic.id, { evidences: toggleEvidence(check?.evidences ?? [], kind) }));
    } else if (event.key === "Backspace") {
      const topic = topics[column];
      if (!topic) return;
      event.preventDefault();
      apply(upsertTeacherCheck(data, current.studentId, subject.id, topic.id, { level: "" }));
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="2단계 · 사용 가능"
        title="교사 평가"
        description="학습주제마다 학생의 수준을 표시합니다. 학교 수준 이름이 있으면 그 이름을 쓰고, 없으면 상·중·하입니다. 이 브라우저에만 저장됩니다."
      />
      {!subject || students.length === 0 ? (
        <p className="sheet px-5 py-8 text-sm leading-7 text-muted">
          학급과 학습주제를 먼저 등록해 주세요. <Link className="text-brand" to="/subjects">학습주제</Link>
        </p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {data.subjects.map((item) => (
              <button key={item.id} type="button" className={cx("shrink-0 rounded-full px-4 py-2 text-sm", item.id === subject.id ? "bg-stage1 font-medium text-white" : "bg-card ring-1 ring-line")} onClick={() => { rememberSubject(item.id); setSubjectId(item.id); }}>
                {item.name}
              </button>
            ))}
          </div>
          {topics.length === 0 ? (
            <p className="sheet mt-4 px-5 py-8 text-sm leading-7 text-muted">
              평가할 학습주제가 없습니다. 진도표에서 불러온 뒤 공개수업·총정리 행은 건너뛰고, 평가요소를 연결해 주세요.{" "}
              <Link className="text-brand" to="/subjects">학습주제로</Link>
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-muted">칸을 고른 뒤 방향키로 이동합니다. 1·2·3은 수준, Q 관찰, W 지필, E 수행평가, Backspace는 수준을 지웁니다.</p>
              <div className="mt-3 overflow-x-auto" role="grid" tabIndex={0} onKeyDown={onKey}>
                <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className={studentColumnClass}>번호</th>
                      {columns.map((column) => (
                        <TopicHeader key={column.topic.id} column={column} onSavePages={savePages} onBulk={setColumnLevel} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <th className={studentColumnClass}>
                          <span className="block truncate">{student.number} {student.alias || ""}</span>
                        </th>
                        {columns.map((column) => (
                          <MemoCell
                            key={column.topic.id}
                            student={student}
                            topic={column.topic}
                            labels={column.labels}
                            check={checks.get(`${student.id}:${column.topic.id}`)}
                            active={focus?.studentId === student.id && focus.unitId === column.topic.id}
                            onFocus={setFocus}
                            onLevel={setLevel}
                            onEvidence={setEvidence}
                            onNote={setNote}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                학생 자기평가는 <Link className="text-brand" to="/questions">자기평가 문제</Link>에서 만들고, 두 결과는 <Link className="text-brand" to="/survey">수준 맞추기</Link>에서 비교합니다.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

const TopicHeader = memo(function TopicHeader({
  column,
  onSavePages,
  onBulk,
}: {
  column: TeachColumn;
  onSavePages: (unitId: string, pages: string) => void;
  onBulk: (unitId: string, level: string) => void;
}) {
  const save = useCallback((pages: string) => onSavePages(column.topic.id, pages), [column.topic.id, onSavePages]);
  return (
    <th className="relative w-44 min-w-44 px-2 py-2 text-left align-bottom font-medium">
      <span className="block">{column.topic.title}</span>
      <span className="mt-0.5 block text-xs font-normal text-muted">{column.elementName}</span>
      <StandardCodes standards={column.standards} />
      {column.hint ? <TopicPages hint={column.hint} onSave={save} /> : null}
      <select
        className="control mt-2 h-9 text-xs"
        aria-label={`${column.topic.title} 열 전체 수준`}
        value=""
        onChange={(event) => {
          const value = event.target.value;
          if (value) onBulk(column.topic.id, value === "__clear" ? "" : value);
        }}
      >
        <option value="">이 열 전체</option>
        {column.labels.map((label) => (
          <option key={label} value={label}>{label}</option>
        ))}
        <option value="__clear">비우기</option>
      </select>
    </th>
  );
});

const TopicPages = memo(function TopicPages({ hint, onSave }: { hint: PageHint; onSave: (pages: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <TopicPagesView
      hint={hint}
      open={open}
      draft={draft}
      onDraft={setDraft}
      onToggle={() => {
        setDraft(hint.shownPages);
        setOpen((value) => !value);
      }}
      onSave={(pages) => {
        onSave(pages);
        setOpen(false);
      }}
    />
  );
});

export function TopicPagesView({
  hint,
  open,
  draft,
  onDraft,
  onToggle,
  onSave,
}: {
  hint: PageHint;
  open: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onToggle: () => void;
  onSave: (pages: string) => void;
}) {
  return (
    <div className="mt-0.5">
      <p className="text-[11px] font-normal leading-4 text-muted">
        {hint.unitPages}
        {hint.extraPages ? ` · 보조 ${hint.extraPages}` : ""}
      </p>
      <button
        type="button"
        className="text-[11px] font-normal leading-4 text-brand"
        aria-expanded={open}
        title={hint.recommendedContent}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {hint.chosen ? "선택" : "추천"} {hint.shownPages}
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-2xl border border-line bg-white p-2 text-left shadow" role="dialog" aria-label="차시 쪽수">
          <ul className="space-y-1">
            {hint.choices.map((choice) => (
              <li key={`${choice.period}-${choice.pages}-${choice.content}`}>
                <button type="button" className="w-full rounded-xl px-2 py-1 text-left text-xs hover:bg-paper" onClick={() => onSave(choice.pages)}>
                  <span className="font-medium">{choice.period}차시 · {choice.pages}</span>
                  <span className="mt-0.5 block font-normal text-muted">{choice.content}</span>
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-2 block text-xs font-normal text-muted">
            쪽수 직접 입력
            <input className="control mt-1 h-8 text-xs" aria-label="쪽수 직접 입력" value={draft} onChange={(event) => onDraft(event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" className="text-xs font-normal text-brand" onClick={() => onSave(draft)}>
              저장
            </button>
            <button type="button" className="text-xs font-normal text-muted" onClick={() => onSave("")}>
              추천으로
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StandardCodes({ standards }: { standards: Array<{ code: string; text: string }> }) {
  const [open, setOpen] = useState<string[]>([]);
  if (standards.length === 0) return null;
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
        {standards.map((standard) => {
          const expanded = open.includes(standard.code);
          return (
            <button
              key={standard.code}
              type="button"
              className="text-[11px] font-normal leading-4 text-brand"
              aria-expanded={expanded}
              title={standard.text || undefined}
              onClick={(event) => {
                event.stopPropagation();
                setOpen((current) => (expanded ? current.filter((code) => code !== standard.code) : [...current, standard.code]));
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              [{standard.code}]
            </button>
          );
        })}
      </div>
      {standards.filter((standard) => open.includes(standard.code) && standard.text).map((standard) => (
        <p key={standard.code} className="mt-0.5 text-[11px] font-normal leading-4 text-muted">
          {standard.text}
        </p>
      ))}
    </div>
  );
}

const MemoCell = memo(function Cell({
  student,
  topic,
  labels,
  check,
  active,
  onFocus,
  onLevel,
  onEvidence,
  onNote,
}: {
  student: Student;
  topic: Unit;
  labels: string[];
  check: ReturnType<typeof findCheck>;
  active: boolean;
  onFocus: (focus: { studentId: string; unitId: string }) => void;
  onLevel: (studentId: string, unitId: string, level: string) => void;
  onEvidence: (studentId: string, unitId: string, kind: EvidenceKind) => void;
  onNote: (studentId: string, unitId: string, note: string) => void;
}) {
  return (
    <td
      data-student-id={student.id}
      data-unit-id={topic.id}
      className={cx("border-t border-line px-2 py-2 align-top", active && "bg-stage1-soft")}
      onClick={() => onFocus({ studentId: student.id, unitId: topic.id })}
    >
      <div className="flex flex-wrap gap-1">
        {labels.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={check?.level === label}
            className={cx("rounded-lg px-2 py-1 text-xs", check?.level === label ? "bg-stage1 font-medium text-white" : "bg-white ring-1 ring-line")}
            onClick={(event) => {
              event.stopPropagation();
              onLevel(student.id, topic.id, label);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {KINDS.map((kind) => {
          const on = check?.evidences.includes(kind) ?? false;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              className={cx("rounded-full px-2 py-0.5 text-[11px]", on ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-line")}
              onClick={(event) => {
                event.stopPropagation();
                onEvidence(student.id, topic.id, kind);
              }}
            >
              {EVIDENCE_LABEL[kind]}
            </button>
          );
        })}
      </div>
      {active || check?.note ? (
        <input
          className="control mt-1 h-8 text-xs"
          maxLength={80}
          placeholder="짧은 메모"
          aria-label={`${student.number}번 ${topic.title} 메모`}
          value={check?.note ?? ""}
          onChange={(event) => onNote(student.id, topic.id, event.target.value)}
          onFocus={() => onFocus({ studentId: student.id, unitId: topic.id })}
        />
      ) : null}
    </td>
  );
}, (previous, next) => previous.student === next.student && previous.topic === next.topic && previous.check === next.check && previous.active === next.active && previous.labels.join("\u0000") === next.labels.join("\u0000") && previous.onFocus === next.onFocus && previous.onLevel === next.onLevel && previous.onEvidence === next.onEvidence && previous.onNote === next.onNote);
