import { useState } from "react";
import { Link } from "react-router-dom";
import { CommentActions } from "../components/CommentActions";
import { CountMeta } from "../components/CountMeta";
import { Button, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { checkComment } from "../lib/commentCheck";
import { findRecord, sortedStudents, upsertRecord } from "../lib/model";

export function ObservePage() {
  usePageTitle("관찰기록");
  const { data, apply } = useAppData();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const subject = data.subjects.find((item) => item.id === subjectId) ?? data.subjects[0] ?? null;
  const students = sortedStudents(data.students).filter((student) => subject && (findRecord(data, student.id, subject.id)?.draft ?? "").trim());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="7단계 · 사용 가능"
        title="나이스 입력용 관찰기록"
        description="적은 평어를 나이스에 넣을 문장으로 다듬습니다. 평어에 없는 사실은 더하지 않습니다."
      />
      <p className="rounded-2xl border border-[#ead7b8] bg-warn-soft px-4 py-3 text-sm leading-6">
        다듬은 문장도 초안입니다. 선생님이 읽고 ‘확인 완료’를 누른 뒤에만 나이스 복사와 엑셀에 들어갑니다.
      </p>
      {!subject ? (
        <p className="sheet mt-4 px-5 py-8 text-sm text-muted">과목을 먼저 등록해 주세요.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {data.subjects.map((item) => (
              <button key={item.id} type="button" className={`shrink-0 rounded-full px-4 py-2 text-sm ${item.id === subject.id ? "bg-stage3 font-medium text-white" : "bg-card ring-1 ring-line"}`} onClick={() => setSubjectId(item.id)}>
                {item.name}
              </button>
            ))}
          </div>
          <CommentActions subjectId={subject.id} studentIds={students.map((student) => student.id)} field="observation" />
          {students.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              다듬을 평어가 없습니다. <Link className="text-brand" to="/records">평어 작성</Link>에서 초안을 먼저 적어 주세요.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {students.map((student) => {
                const record = findRecord(data, student.id, subject.id);
                const text = record?.observation ?? "";
                const flags = checkComment(text, {
                  answers: data.responses.filter((response) => response.studentId === student.id).flatMap((response) => response.answers.map((answer) => answer.raw)),
                  standardTexts: subject.standards.map((standard) => standard.text),
                });
                return (
                  <li key={student.id} className="sheet p-4">
                    <p className="font-medium">{student.number}번 {student.alias || "별칭 없음"}</p>
                    <p className="mt-2 text-sm text-muted">평어</p>
                    <p className="whitespace-pre-wrap text-sm leading-6">{record?.draft}</p>
                    <label className="mt-3 block text-sm font-medium">
                      나이스 문장
                      <textarea
                        className="control mt-1"
                        rows={4}
                        value={text}
                        onChange={(event) => apply(upsertRecord(data, student.id, subject.id, { observation: event.target.value }).data)}
                      />
                    </label>
                    {flags.map((flag) => (
                      <p key={flag.message} className="mt-2 text-sm leading-6 text-warn">
                        {flag.message} {flag.suggestion}
                      </p>
                    ))}
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <CountMeta text={text} />
                      <Button
                        variant={record?.observationConfirmed ? "secondary" : "primary"}
                        disabled={!text.trim()}
                        onClick={() => apply(upsertRecord(data, student.id, subject.id, { observationConfirmed: !record?.observationConfirmed }).data)}
                      >
                        {record?.observationConfirmed ? "확인 취소" : "확인 완료"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
