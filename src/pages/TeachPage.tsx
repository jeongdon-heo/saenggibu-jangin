import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { cx, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { sortedStudents } from "../lib/model";
import { bulkSetColumn, EVIDENCE_LABEL, findCheck, lessonTopics, levelLabels, toggleEvidence, topicStandards, upsertTeacherCheck } from "../lib/teacherAssess";
import type { EvidenceKind, Student, Unit } from "../types";

const KINDS: EvidenceKind[] = ["observe", "paper", "performance"];
const KIND_KEY: Record<string, EvidenceKind> = { q: "observe", w: "paper", e: "performance" };

export function TeachPage() {
  usePageTitle("교사 평가");
  const { data, apply } = useAppData();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ studentId: string; unitId: string } | null>(null);
  const subject = data.subjects.find((item) => item.id === subjectId) ?? data.subjects[0] ?? null;
  const students = sortedStudents(data.students);
  const topics = subject ? lessonTopics(subject) : [];

  function move(row: number, column: number) {
    const student = students[row];
    const topic = topics[column];
    if (!student || !topic) return;
    setFocus({ studentId: student.id, unitId: topic.id });
  }

  function onKey(event: KeyboardEvent) {
    if (!subject || !focus) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) return;
    const row = students.findIndex((student) => student.id === focus.studentId);
    const column = topics.findIndex((topic) => topic.id === focus.unitId);
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
      apply(upsertTeacherCheck(data, focus.studentId, subject.id, topic.id, { level }));
    } else if (KIND_KEY[event.key]) {
      const topic = topics[column];
      const kind = KIND_KEY[event.key];
      if (!topic || !kind) return;
      event.preventDefault();
      const current = findCheck(data, focus.studentId, topic.id);
      apply(upsertTeacherCheck(data, focus.studentId, subject.id, topic.id, { evidences: toggleEvidence(current?.evidences ?? [], kind) }));
    } else if (event.key === "Backspace") {
      const topic = topics[column];
      if (!topic) return;
      event.preventDefault();
      apply(upsertTeacherCheck(data, focus.studentId, subject.id, topic.id, { level: "" }));
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
              <button key={item.id} type="button" className={cx("shrink-0 rounded-full px-4 py-2 text-sm", item.id === subject.id ? "bg-stage1 font-medium text-white" : "bg-card ring-1 ring-line")} onClick={() => setSubjectId(item.id)}>
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
                <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-paper px-2 py-2 text-left">번호</th>
                      {topics.map((topic) => (
                        <th key={topic.id} className="min-w-44 px-2 py-2 text-left align-bottom font-medium">
                          <span className="block">{topic.title}</span>
                          <span className="mt-0.5 block text-xs font-normal text-muted">{subject.elements.find((element) => element.id === topic.elementId)?.name || "평가요소 없음"}</span>
                          <StandardCodes standards={topicStandards(subject, topic)} />
                          <select
                            className="control mt-2 h-9 text-xs"
                            aria-label={`${topic.title} 열 전체 수준`}
                            value=""
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) return;
                              apply(bulkSetColumn(data, subject.id, topic.id, value === "__clear" ? "" : value));
                            }}
                          >
                            <option value="">이 열 전체</option>
                            {levelLabels(subject, topic).map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                            <option value="__clear">비우기</option>
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <th className="sticky left-0 z-10 bg-paper px-2 py-2 text-left font-medium">{student.number} {student.alias || ""}</th>
                        {topics.map((topic) => (
                          <Cell
                            key={topic.id}
                            student={student}
                            topic={topic}
                            labels={levelLabels(subject, topic)}
                            active={focus?.studentId === student.id && focus.unitId === topic.id}
                            onFocus={() => setFocus({ studentId: student.id, unitId: topic.id })}
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

function Cell({
  student,
  topic,
  labels,
  active,
  onFocus,
}: {
  student: Student;
  topic: Unit;
  labels: string[];
  active: boolean;
  onFocus: () => void;
}) {
  const { data, apply } = useAppData();
  const subjectId = data.subjects.find((subject) => subject.units.some((unit) => unit.id === topic.id))?.id ?? "";
  const check = findCheck(data, student.id, topic.id);
  return (
    <td className={cx("border-t border-line px-2 py-2 align-top", active && "bg-stage1-soft")} onClick={onFocus}>
      <div className="flex flex-wrap gap-1">
        {labels.map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={check?.level === label}
            className={cx("rounded-lg px-2 py-1 text-xs", check?.level === label ? "bg-stage1 font-medium text-white" : "bg-white ring-1 ring-line")}
            onClick={() => apply(upsertTeacherCheck(data, student.id, subjectId, topic.id, { level: check?.level === label ? "" : label }))}
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
              onClick={() => apply(upsertTeacherCheck(data, student.id, subjectId, topic.id, { evidences: toggleEvidence(check?.evidences ?? [], kind) }))}
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
          onChange={(event) => apply(upsertTeacherCheck(data, student.id, subjectId, topic.id, { note: event.target.value }))}
          onFocus={onFocus}
        />
      ) : null}
    </td>
  );
}
