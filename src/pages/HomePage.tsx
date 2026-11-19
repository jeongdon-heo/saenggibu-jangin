import { ChevronDown, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppData } from "../context/DataContext";
import { useToast } from "../components/Toast";
import { createDemoData } from "../lib/defaults";
import { saveBackupFile } from "../lib/files";
import { classSummary } from "../lib/format";
import { findRecord } from "../lib/model";
import { stageStyle, stages, statusLabel, steps } from "../lib/steps";
import { usePageTitle } from "../hooks/usePageTitle";
import { cx } from "../components/ui";

export function HomePage() {
  usePageTitle("홈");
  const { data, apply } = useAppData();
  const toast = useToast();
  const summary = classSummary(data.classInfo);
  const empty = data.students.length === 0 && data.subjects.length === 0 && data.records.length === 0;
  const pairs = data.students.length * data.subjects.length;
  const done = data.subjects.reduce((sum, subject) => {
    return (
      sum +
      data.students.filter((student) => (findRecord(data, student.id, subject.id)?.draft ?? "").trim().length > 0).length
    );
  }, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-3xl border border-[#ead7b8] bg-warn-soft px-5 py-4">
        <div className="flex gap-3">
          <Lock className="mt-1 size-5 shrink-0 text-warn" aria-hidden />
          <div>
            <h1 className="text-base font-bold text-ink">학생 정보와 기록은 이 브라우저에만 저장됩니다.</h1>
            <p className="mt-1 text-sm leading-6 text-ink">
              서버로 보내지 않습니다. 브라우저 기록을 지우거나 다른 컴퓨터를 쓰면 사라지니, 백업 파일을 저장해 두세요.
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
              onClick={() => {
                saveBackupFile(data);
                toast("백업 파일을 저장했습니다.");
              }}
            >
              백업 파일 저장
            </button>
          </div>
        </div>
      </section>

      <header className="mt-8">
        <p className="text-sm font-medium text-muted">손글씨 메모를 기록으로</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-ink">학기말 교과학습발달상황</h2>
        <p className="mt-2 text-base leading-7 text-muted">
          {summary ? `${summary} 기록을 이어서 정리합니다.` : "학년과 반을 정한 뒤, 성취기준을 넣고 평어를 적으면 됩니다."}
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="학생" value={`${data.students.length}명`} href="/class" />
        <Stat label="과목" value={`${data.subjects.length}개`} href="/subjects" />
        <Stat label="문장" value={pairs === 0 ? "0" : `${done}/${pairs}`} href="/records" />
      </section>

      {empty ? (
        <section className="sheet mt-4 p-5">
          <h3 className="font-bold">처음이라면 예시로 먼저 봐 보세요</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            실명이 아닌 별칭 세 명과 국어 예시가 들어갑니다. 언제든 지울 수 있습니다.
          </p>
          <button
            type="button"
            className="mt-3 h-11 rounded-2xl bg-brand px-4 text-sm font-medium text-white"
            onClick={() => {
              apply(createDemoData(data.classInfo));
              toast("예시 학급을 넣었습니다.");
            }}
          >
            예시로 둘러보기
          </button>
        </section>
      ) : null}

      {!empty && pairs > 0 ? (
        <section className="sheet mt-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold">평어 {done} / {pairs}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">문장이 비어 있는 학생부터 이어서 적어도 됩니다.</p>
          </div>
          <Link to="/records" className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-4 text-sm font-medium text-white">
            평어 이어서 쓰기
          </Link>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="flow-title">
        <div className="mb-4">
          <h3 id="flow-title" className="text-xl font-bold">작성 흐름</h3>
          <p className="mt-1 text-sm leading-6 text-muted">여덟 단계 가운데 지금 쓸 수 있는 곳만 먼저 열어둡니다.</p>
        </div>
        {stages.map((stage, index) => {
          const tone = stageStyle[stage.tone];
          const stageSteps = steps.filter((step) => step.stage === stage.id);
          return (
            <div key={stage.id}>
              <article className="sheet overflow-hidden">
                <div className={cx("border-l-[6px] px-4 py-5 sm:px-6", tone.border)}>
                  <h4 className={cx("text-lg font-bold", tone.text)}>
                    {stage.id}단계 · {stage.title}
                  </h4>
                  <ol className="mt-4 space-y-2.5">
                    {stageSteps.map((step) => (
                      <li key={step.id}>
                        <Link
                          to={step.href}
                          className={cx("flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:brightness-[0.98]", tone.soft)}
                        >
                          <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white", tone.bg)}>
                            {step.id}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium leading-6 text-ink">{step.title}</span>
                            <span className="mt-0.5 block text-sm leading-5 text-muted">{step.summary}</span>
                          </span>
                          <span
                            className={cx(
                              "shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium",
                              step.status === "soon" ? "text-muted" : tone.text,
                            )}
                          >
                            {statusLabel[step.status]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
              {index < stages.length - 1 ? (
                <div className="flex justify-center py-2 text-muted" aria-hidden>
                  <span className="grid size-8 place-items-center rounded-full border border-line bg-card">
                    <ChevronDown className="size-4" />
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <p className="mt-8 text-sm leading-6 text-muted">
        나이스에는 이 앱이 들어가지 않습니다. 문장을 복사해 선생님이 직접 붙여넣습니다.
      </p>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link to={href} className="sheet block px-4 py-3 hover:border-brand/30">
      <span className="block text-sm text-muted">{label}</span>
      <span className="mt-1 block text-xl font-bold tabular-nums">{value}</span>
    </Link>
  );
}
