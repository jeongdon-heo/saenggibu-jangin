import { useToast } from "./Toast";
import { Button } from "./ui";
import { useAppData } from "../context/DataContext";
import { defaultCommentRules, type CommentRules } from "../lib/commentRules";

function digits(value: string, min: number, max: number): number {
  const number = Number(value.replace(/[^\d]/g, "") || "0");
  return Math.min(max, Math.max(min, number));
}

export function CommentRulesPanel() {
  const { data, apply } = useAppData();
  const toast = useToast();
  const rules = data.commentRules ?? defaultCommentRules();

  function save(next: CommentRules) {
    apply({ ...data, commentRules: next });
  }

  return (
    <section className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">평어 규칙</h2>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            save(defaultCommentRules());
            toast("평어 규칙을 기본값으로 되돌렸습니다.");
          }}
        >
          기본값으로 되돌리기
        </Button>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted">이 브라우저에 저장되고 학급 백업에도 들어갑니다. 초안을 만들 때와 프롬프트를 복사할 때 같이 쓰입니다.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          글자 수 최소
          <input className="control mt-1" inputMode="numeric" aria-label="글자 수 최소" value={rules.lengthMin} onChange={(event) => save({ ...rules, lengthMin: digits(event.target.value, 40, 1500) })} />
        </label>
        <label className="text-sm">
          글자 수 최대
          <input className="control mt-1" inputMode="numeric" aria-label="글자 수 최대" value={rules.lengthMax} onChange={(event) => save({ ...rules, lengthMax: digits(event.target.value, 40, 1500) })} />
        </label>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted">기본은 250~400자입니다. 1학년은 이 범위를 그대로 두면 180~220자로 맞춥니다.</p>
      <div className="mt-3 space-y-2 text-sm leading-6">
        <label className="flex items-start gap-2">
          <input className="mt-1" type="checkbox" checked={rules.nounEnding} onChange={(event) => save({ ...rules, nounEnding: event.target.checked })} />
          <span>명사형 종결. ‘~함’, ‘~임’, ‘~보임’으로 쓰고, 같은 어미를 연달아 반복하지 않습니다.</span>
        </label>
        <label className="flex items-start gap-2">
          <input className="mt-1" type="checkbox" checked={rules.concreteLevel} onChange={(event) => save({ ...rules, concreteLevel: event.target.checked })} />
          <span>성취 수준은 ‘우수함’, ‘부족함’ 같은 등급 말이 아니라 구체적인 표현으로 드러냅니다.</span>
        </label>
        <label className="flex items-start gap-2">
          <input className="mt-1" type="checkbox" checked={rules.noHope} onChange={(event) => save({ ...rules, noHope: event.target.checked })} />
          <span>기대·당부 문장을 넣지 않습니다. ‘~할 것으로 기대됨’ 같은 말은 쓰지 않습니다.</span>
        </label>
      </div>
      <label className="mt-4 block text-sm font-medium">
        추가 규칙
        <textarea className="control mt-1" rows={4} aria-label="추가 규칙" value={rules.extra} onChange={(event) => save({ ...rules, extra: event.target.value.slice(0, 2000) })} />
      </label>
    </section>
  );
}
