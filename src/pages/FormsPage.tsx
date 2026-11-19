import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import { Button, cx, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { copyText } from "../lib/copyText";
import { buildFormPreview, buildFormScript, selectedQuestions, studentFormText } from "../lib/formScript";
import { guardPrompt } from "../lib/guard";

export function FormsPage() {
  usePageTitle("구글 폼 배포");
  const { data } = useAppData();
  const toast = useToast();
  const subjects = data.subjects.filter((subject) => selectedQuestions(data.questions, subject.id).length > 0);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const subject = subjects.find((item) => item.id === subjectId) ?? subjects[0] ?? null;
  const questions = subject ? selectedQuestions(data.questions, subject.id) : [];
  const preview = subject ? buildFormPreview(data.classInfo, subject.name, questions) : null;
  const script = preview ? buildFormScript(preview) : "";
  const guarded = script ? guardPrompt(script, data) : null;

  async function copyScript() {
    if (!guarded || !guarded.ok) return;
    const copied = await copyText(guarded.data);
    toast(copied ? "스크립트를 복사했습니다. 구글 계정에서 실행하세요." : "복사하지 못했습니다. 스크립트를 드래그해 복사해 주세요.");
  }

  async function copyPlain() {
    if (!preview) return;
    const text = studentFormText(preview);
    const checked = guardPrompt(text, data);
    if (!checked.ok) return;
    const copied = await copyText(checked.data);
    toast(copied ? "학생에게 보여줄 문항만 복사했습니다." : "복사하지 못했습니다.");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="4단계 · 사용 가능"
        title="구글 폼으로 만들고 배포"
        description="3단계에서 고른 문제만 폼으로 만듭니다. 학생에게는 번호와 문항, 보기만 보입니다. 구글 계정은 이 앱에 저장하지 않습니다."
      />
      {subjects.length === 0 ? (
        <p className="sheet px-5 py-8 text-sm leading-6 text-muted">
          보낼 문제가 없습니다. <Link className="text-brand" to="/select">과목별 문제 선택</Link>에서 확정한 문제를 골라 주세요.
        </p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {subjects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx("shrink-0 rounded-full px-4 py-2 text-sm", item.id === subject?.id ? "bg-stage2 font-medium text-white" : "bg-card ring-1 ring-line")}
                onClick={() => setSubjectId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          {preview ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="sheet p-5">
                <p className="text-sm font-medium text-stage2">학생이 보는 폼</p>
                <h2 className="mt-2 text-xl font-bold">{preview.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{preview.description}</p>
                <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3">
                  <p className="font-medium">번호 <span className="text-danger">*</span></p>
                  <p className="text-sm text-muted">{preview.numberHelp}</p>
                  <div className="mt-2 h-10 rounded-xl border border-line bg-white" />
                </div>
                <ol className="mt-3 space-y-3">
                  {preview.items.map((item, index) => (
                    <li key={item.questionId} className="rounded-2xl border border-line px-4 py-3">
                      <p className="text-sm text-muted">{index + 1}. {item.typeLabel} · {item.studentControl}</p>
                      <p className="mt-1 whitespace-pre-wrap leading-7">{item.prompt}</p>
                      {item.choices.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm">
                          {item.choices.map((choice) => (
                            <li key={choice} className="flex items-center gap-2">
                              <span className="size-3 rounded-full border border-line" />
                              {choice}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-2 h-16 rounded-xl border border-dashed border-line" />
                      )}
                    </li>
                  ))}
                </ol>
              </section>
              <section className="space-y-4">
                <div className="sheet p-5">
                  <h2 className="font-bold">정답은 폼에 넣지 않습니다</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    정답, 채점 기준, 목표 수준은 이 앱에만 남습니다. 학생 이름과 별칭도 폼에 들어가지 않습니다. 구글 비밀번호나 로그인 정보는 저장하지 않습니다.
                  </p>
                  <p className="mt-3 text-sm leading-6">
                    폼은 선생님 구글 계정에서 스크립트를 실행해 만듭니다. 이 앱이 구글에 로그인하지 않으므로, 계정과 학급 기록이 섞이지 않습니다.
                  </p>
                </div>
                {guarded && !guarded.ok ? <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger">{guarded.error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!guarded?.ok} onClick={() => void copyScript()}>
                    스크립트 복사
                  </Button>
                  <Button variant="secondary" disabled={!guarded?.ok} onClick={() => void copyPlain()}>
                    문항만 텍스트로 복사
                  </Button>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-muted">
                  <li>스크립트를 복사합니다.</li>
                  <li>script.google.com 에서 새 프로젝트를 만듭니다.</li>
                  <li>붙여넣고 실행한 뒤, 본인 계정 권한을 허용합니다.</li>
                  <li>로그의 학생 링크만 보내세요. 편집 링크는 선생님만 둡니다.</li>
                  <li>응답은 시트에서 CSV로 받아 다음 단계에서 불러옵니다.</li>
                </ol>
                <details className="sheet p-4" open>
                  <summary className="cursor-pointer text-sm font-medium">실행할 스크립트</summary>
                  <textarea className="control mt-3 font-mono text-sm" readOnly rows={12} value={guarded?.ok ? guarded.data : ""} />
                </details>
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
