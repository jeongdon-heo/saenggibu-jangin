import { useState } from "react";
import { useToast } from "../components/Toast";
import { Button, cx, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { questionTypeLabel } from "../lib/questionTypes";
import { sortedStudents } from "../lib/model";
import { effectiveScore, importSurveyCsv, setAnswerMark, setLevelChoice, shownLevel } from "../lib/survey";
import { combinedFor, EVIDENCE_LABEL, setLevelDecision } from "../lib/teacherAssess";
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
        title="두 방향 수준 맞추기"
        description="학생 설문 CSV를 번호로 연결해 채점하고, 아래에서 교사 평가와 나란히 보아 수준을 확정합니다."
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
      <CombinePanel />
    </div>
  );
}

function CombinePanel() {
  const { data, apply } = useAppData();
  const students = sortedStudents(data.students);
  if (data.subjects.length === 0 || students.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">교사 평가와 학생 설문</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        제안 수준은 교사 평가가 있으면 그것을 따릅니다. 두 수준이 다르면 표시만 하고, 확정은 선생님이 고릅니다. 확정한 수준이 평어에 들어갑니다.
      </p>
      {data.subjects.map((subject) => (
        <div key={subject.id} className="mt-4">
          <h3 className="font-medium">{subject.name}</h3>
          {subject.elements.length === 0 ? <p className="mt-2 text-sm text-muted">평가요소가 없습니다.</p> : null}
          {subject.elements.map((element) => (
            <div key={element.id} className="sheet mt-2 overflow-x-auto p-3">
              <p className="font-medium">{element.name}</p>
              <table className="mt-2 w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-2 font-medium">번호</th>
                    <th className="py-1 pr-2 font-medium">교사 평가</th>
                    <th className="py-1 pr-2 font-medium">학생 설문</th>
                    <th className="py-1 pr-2 font-medium">제안</th>
                    <th className="py-1 font-medium">확정</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const row = combinedFor(data, subject.id, student.id).find((item) => item.elementId === element.id);
                    if (!row) return null;
                    return (
                      <tr key={student.id} className={row.disagree ? "bg-warn-soft" : undefined}>
                        <td className="py-1 pr-2">{student.number} {student.alias || ""}</td>
                        <td className="py-1 pr-2">
                          {row.teacherLevel || "없음"}
                          {row.teacherMixed ? " · 주제마다 다름" : ""}
                          {row.evidences.length > 0 ? <span className="block text-xs text-muted">{row.evidences.map((kind) => EVIDENCE_LABEL[kind]).join("·")}</span> : null}
                        </td>
                        <td className="py-1 pr-2">{row.surveyLevel || "없음"}</td>
                        <td className="py-1 pr-2">
                          {row.suggested || "없음"}
                          {row.disagree ? <span className="block text-xs text-warn">불일치</span> : null}
                        </td>
                        <td className="py-1">
                          <select
                            className="control h-9"
                            aria-label={`${student.number}번 ${element.name} 확정 수준`}
                            value={row.confirmed}
                            onChange={(event) => {
                              const level = event.target.value;
                              apply(setLevelDecision(data, student.id, subject.id, element.id, level, Boolean(level)));
                            }}
                          >
                            <option value="">{row.suggested ? `제안 ${row.suggested}` : "아직 없음"}</option>
                            {row.labels.map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </section>
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
          <p className="mt-1 text-sm leading-6 text-muted">학생 설문 채점을 보정합니다. 교사 평가와 합친 확정은 아래 표에서 합니다.</p>
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
