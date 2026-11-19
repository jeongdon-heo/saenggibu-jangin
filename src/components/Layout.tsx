import { BookOpen, Menu, NotebookPen, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAppData } from "../context/DataContext";
import { classSummary } from "../lib/format";
import { stageStyle, stages, statusLabel, steps } from "../lib/steps";
import { BackupActions, RecoverGate } from "./BackupActions";
import { cx } from "./ui";

export function Layout() {
  const { data, savedText, warning } = useAppData();
  const summary = classSummary(data.classInfo);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-card focus:px-3 focus:py-2"
      >
        본문으로
      </a>
      {open ? (
        <button type="button" className="fixed inset-0 z-30 bg-ink/40 lg:hidden" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />
      ) : null}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex h-full w-72 flex-col border-r border-line bg-card transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white">
              <NotebookPen className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-bold leading-tight">생기부장인</span>
              <span className="block text-sm text-muted">학기말 기록 도우미</span>
            </span>
          </div>
          <button type="button" className="grid size-10 place-items-center rounded-xl hover:bg-paper lg:hidden" onClick={() => setOpen(false)} aria-label="메뉴 닫기">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <p className="mx-4 mb-3 rounded-2xl bg-warn-soft px-3 py-2 text-xs leading-5 text-warn">이 브라우저에만 저장됩니다. 서버로 보내지 않습니다.</p>
        <p className="mx-4 mb-3 truncate text-sm text-muted">{summary ?? "학급을 아직 정하지 않았습니다"}</p>
        <nav aria-label="작성 단계" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" onClick={() => setOpen(false)}>
          <NavItem to="/" end icon={<BookOpen className="size-4" aria-hidden />}>
            홈
          </NavItem>
          <NavItem to="/class">학급 설정</NavItem>
          {stages.map((stage) => {
            const tone = stageStyle[stage.tone];
            return (
              <div key={stage.id} className="mt-4">
                <p className={cx("px-3 pb-1 text-xs font-bold", tone.text)}>
                  {stage.id}단계 · {stage.title}
                </p>
                {steps
                  .filter((step) => step.stage === stage.id)
                  .map((step) => (
                    <NavItem key={step.id} to={step.href}>
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white", tone.bg)}>
                          {step.id}
                        </span>
                        <span className="truncate">{step.nav}</span>
                      </span>
                      {step.status !== "ready" ? (
                        <span className="shrink-0 text-[11px] font-medium text-muted">{statusLabel[step.status]}</span>
                      ) : null}
                    </NavItem>
                  ))}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-line px-3 py-3">
          <p className="mb-2 px-1 text-xs text-muted">{savedText}</p>
          <BackupActions compact />
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" className="grid size-10 place-items-center rounded-xl border border-line" onClick={() => setOpen(true)} aria-label="메뉴 열기">
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-bold">생기부장인</p>
            <p className="truncate text-xs text-muted">{summary ?? "학급 미설정"}</p>
          </div>
        </header>
        {warning ? (
          <div className="border-b border-danger/20 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger sm:px-8">{warning}</div>
        ) : null}
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
      <RecoverGate />
    </div>
  );
}

function NavItem({
  to,
  end,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          "mt-1 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm",
          isActive ? "bg-brand-soft font-medium text-brand" : "text-ink hover:bg-paper",
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}
