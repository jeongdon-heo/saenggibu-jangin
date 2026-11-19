import { Link } from "react-router-dom";
import { useState } from "react";
import { AiReviewNote } from "../components/AiReviewNote";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { questionsFor, updateQuestion } from "../lib/curriculum";
import { questionTypeLabel } from "../lib/questionTypes";
import { cx, PageHeader } from "../components/ui";

export function SelectPage() {
  usePageTitle("과목별 문제 선택");
  const { data, apply } = useAppData();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const subject = data.subjects.find((item) => item.id === subjectId) ?? data.subjects[0] ?? null;
  const approved = subject ? questionsFor(data, subject.id).filter((question) => question.approved) : [];
  const selected = approved.filter((question) => question.selected).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="3단계 · 사용 가능"
        title="과목별 문제 선택"
        description="확정한 문제 가운데 나중에 설문으로 보낼 것을 고릅니다. 구글 폼으로 만드는 단계는 아직 준비 중입니다."
      />
      <AiReviewNote />
      {data.subjects.length === 0 ? (
        <p className="sheet mt-4 px-5 py-8 text-sm text-muted">과목을 먼저 등록해 주세요.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {data.subjects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx("shrink-0 rounded-full px-4 py-2 text-sm", item.id === subject?.id ? "bg-stage1 font-medium text-white" : "bg-card ring-1 ring-line")}
                onClick={() => setSubjectId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            {subject?.name}에서 보낼 문제 <strong className="text-ink">{selected}</strong> / 확정 {approved.length}
          </p>
          {approved.length === 0 ? (
            <p className="sheet mt-4 px-5 py-8 text-sm leading-6 text-muted">
              확정된 문제가 없습니다. <Link to="/questions" className="text-brand">문제 만들기</Link>에서 검토한 뒤 확정해 주세요.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {approved.map((question, index) => (
                <li key={question.id} className="sheet p-4">
                  <label className="flex items-start gap-3">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={question.selected}
                      onChange={(event) => apply(updateQuestion(data, question.id, { selected: event.target.checked }))}
                    />
                    <span>
                      <span className="text-sm text-muted">
                        {index + 1}. {questionTypeLabel(question.type)} · {question.targetLevel || "수준 미정"} · {question.elementName || "평가요소 미정"}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap leading-7">{question.prompt}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
