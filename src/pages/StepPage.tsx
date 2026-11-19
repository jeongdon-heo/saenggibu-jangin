import { Link, Navigate, useParams } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { stageStyle, stages, statusLabel, stepById } from "../lib/steps";
import { cx } from "../components/ui";

export function StepPage() {
  const params = useParams();
  const step = stepById(Number(params.stepId));
  usePageTitle(step?.nav ?? "준비 중");
  if (!step) return <NotFoundPage />;
  if (step.status === "ready") return <Navigate to={step.href} replace />;

  const stage = stages.find((item) => item.id === step.stage);
  const tone = stage ? stageStyle[stage.tone] : stageStyle.stage1;

  return (
    <div className="mx-auto max-w-3xl">
      <p className={cx("text-sm font-bold", tone.text)}>
        {step.stage}단계 · {statusLabel[step.status]}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{step.title}</h1>
      <div className={cx("mt-6 rounded-3xl border-l-[6px] bg-card px-5 py-5", tone.border)}>
        <p className="text-base leading-7">{step.lead}</p>
        {step.paragraphs.map((paragraph) => (
          <p key={paragraph} className="mt-3 text-base leading-7 text-muted">
            {paragraph}
          </p>
        ))}
      </div>
      {step.now ? <p className="mt-6 text-base leading-7">{step.now}</p> : null}
      {step.action ? (
        <Link to={step.action.href} className="mt-4 inline-flex h-11 items-center rounded-2xl bg-brand px-4 text-sm font-medium text-white">
          {step.action.label}
        </Link>
      ) : null}
      <p className="mt-8">
        <Link to="/" className="text-sm font-medium text-brand">
          작성 흐름으로 돌아가기
        </Link>
      </p>
    </div>
  );
}

export function NotFoundPage() {
  usePageTitle("없는 페이지");
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">페이지를 찾지 못했습니다</h1>
      <p className="mt-2 text-muted">주소가 바뀌었거나 없는 화면입니다.</p>
      <Link to="/" className="mt-4 inline-flex h-11 items-center rounded-2xl bg-brand px-4 text-sm font-medium text-white">
        처음으로
      </Link>
    </div>
  );
}
