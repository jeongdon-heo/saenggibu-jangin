import { useState } from "react";
import { useToast } from "../components/Toast";
import { Button, cx, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { questionTypeLabel } from "../lib/questionTypes";
import { effectiveScore, importSurveyCsv, setAnswerMark, setLevelChoice, shownLevel } from "../lib/survey";
import type { ScoreMark, SurveyAnswer, SurveyResponse } from "../types";

const SCORE_LABEL: Record<ScoreMark, string> = {
  correct: "맞음",
  incorrect: "아님",
  partial: "부분",
  unscored: "채점 전",
};

export function SurveyPage() {
  usePageTitle("학생 설문");
  const { data, apply } = useAppData();
  const toast = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const responses = [...data.responses].sort((a, b) => numberValue(a.numberText) - numberValue(b.numberText));
  const selected = responses.find((response) => response.id === selectedId) ?? responses[0] ?? null;
  const student = data.students.find((item) => item.id === selected?.studentId);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const result = importSurveyCsv(data, await file.text());
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    const unknown = result.report?.unknownNumbers.length ? ` 명단에 없는 번호: ${result.report.unknownNumbers.join(", ")}.` : "";
    const headers = result.report?.unmatchedHeaders.length ? ` 연결하지 못한 열: ${result.report.unmatchedHeaders.join(", ")}.` : "";
    setMessage(`응답 ${result.report?.linked ?? 0}개를 번호와 연결했습니다.${unknown}${headers}`);
    toast("응답을 이 브라우저에 저장했습니다.");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="5단계 · 사용 가능"
        title="학생 설문과 응답 살펴보기"
        description="구글 시트에서 받은 CSV를 이 브라우저에서만 읽습니다. 번호로 명단과 연결하고, 객관식은 자동으로 채점합니다."
        actions={
          <label className="inline-flex h-11 cursor-pointer items-center rounded-2xl bg-brand px-4 text-sm font-medium text-white">
            CSV 불러오기
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onFile(file);
              }}
            />
          </label>
        }
      />
      <p className="rounded-2xl border border-[#ead7b8] bg-warn-soft px-4 py-3 text-sm leading-6">
        학생 답은 성취수준을 가늠하는 근거입니다. 2026 기재요령에 따라 학생이 쓴 문장을 생기부 특기사항에 그대로 옮기지 마세요.
      </p>
      <p className="mt-3 text-sm leading-6 text-muted">
        구글 폼 응답을 스프레드시트로 연 뒤, 파일에서 CSV로 내려받으세요. 첫 줄에 ‘번호’와 문항 이름이 있어야 합니다.
      </p>
      {message ? <p className="mt-3 text-sm leading-6 text-brand">{message}</p> : null}
      {responses.length === 0 ? (
        <p className="sheet mt-4 px-5 py-8 text-sm text-muted">아직 불러온 응답이 없습니다.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_1fr]">
          <ul className="space-y-2">
            {responses.map((response) => {
              const person = data.students.find((item) => item.id === response.studentId);
              return (
                <li key={response.id}>
                  <button
                    type="button"
                    className={cx("w-full rounded-2xl px-3 py-2 text-left text-sm", selected?.id === response.id ? "bg-stage2-soft" : "bg-card ring-1 ring-line")}
                    onClick={() => setSelectedId(response.id)}
                  >
                    <span className="font-medium">{response.numberText}번</span>
                    <span className="mt-0.5 block text-muted">{person ? person.alias || "별칭 없음" : "명단에 없는 번호"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected ? (
            <ResponseDetail
              response={selected}
              alias={student?.alias ?? ""}
              onScore={(questionId, score) => apply(setAnswerMark(data, selected.id, questionId, score))}
              onLevel={(estimateId, level) => apply(setLevelChoice(data, estimateId, level))}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function numberValue(value: string): number {
  const parsed = Number(value.replace(/번$/, ""));
  return Number.isFinite(parsed) ? parsed : 9999;
}

function ResponseDetail({
  response,
  alias,
  onScore,
  onLevel,
}: {
  response: SurveyResponse;
  alias: string;
  onScore: (questionId: string, score: SurveyAnswer["teacherScore"]) => void;
  onLevel: (estimateId: string, level: string) => void;
}) {
  const { data } = useAppData();
  const estimates = data.levelEstimates.filter((item) => item.studentId === response.studentId);
  return (
    <section className="space-y-4">
      <div className="sheet p-4">
        <h2 className="text-lg font-bold">{response.numberText}번 {alias}</h2>
        <p className="text-sm text-muted">{response.submittedAt || "제출 시각 없음"} · 답은 근거로만 봅니다.</p>
      </div>
      {response.answers.map((answer) => {
        const question = data.questions.find((item) => item.id === answer.questionId);
        if (!question) return null;
        const score = effectiveScore(answer);
        return (
          <article key={answer.questionId} className="sheet p-4">
            <p className="text-sm text-muted">{question.elementName} · {questionTypeLabel(question.type)} · {SCORE_LABEL[score]}</p>
            <p className="mt-1 whitespace-pre-wrap leading-7">{question.prompt}</p>
            <p className="mt-3 text-sm font-medium">학생 답</p>
            <p className="mt-1 whitespace-pre-wrap rounded-2xl bg-paper px-3 py-2 text-sm leading-6">{answer.raw || "비어 있음"}</p>
            {question.type === "essay" || question.type === "check" ? (
              <p className="mt-3 text-sm leading-6 text-muted">채점 기준: {question.rubric || "아직 없습니다."}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {(["correct", "partial", "incorrect", ""] as const).map((mark) => (
                <Button key={mark || "auto"} size="sm" variant={answer.teacherScore === mark ? "primary" : "secondary"} onClick={() => onScore(answer.questionId, mark)}>
                  {mark === "" ? "자동" : SCORE_LABEL[mark]}
                </Button>
              ))}
            </div>
          </article>
        );
      })}
      {estimates.length > 0 ? (
        <section className="sheet p-4">
          <h3 className="font-bold">평가요소별 추정 수준</h3>
          <p className="mt-1 text-sm leading-6 text-muted">나중에 평어를 쓸 때 근거로 봅니다. 학생 답 문장은 평어 칸으로 복사되지 않습니다.</p>
          <ul className="mt-3 space-y-3">
            {estimates.map((estimate) => {
              const subject = data.subjects.find((item) => item.id === estimate.subjectId);
              const labels = subject?.elements.find((item) => item.id === estimate.elementId)?.levels.map((level) => level.label).filter(Boolean) ?? [];
              return (
                <li key={estimate.id} className="grid gap-2 sm:grid-cols-[1fr_12rem] sm:items-center">
                  <span>
                    <span className="font-medium">{estimate.elementName}</span>
                    <span className="mt-0.5 block text-sm text-muted">자동 추정 {estimate.suggestedLevel || "없음"} · 지금 {shownLevel(estimate) || "없음"}</span>
                  </span>
                  <select className="control" value={estimate.teacherLevel} onChange={(event) => onLevel(estimate.id, event.target.value)}>
                    <option value="">자동 추정 사용</option>
                    {labels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
