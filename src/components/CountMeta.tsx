import { useId, useState } from "react";
import { Info } from "lucide-react";
import { COUNT_NOTES, countChars, countNeisBytes } from "../lib/textCount";

export function CountMeta({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const chars = countChars(text);
  const bytes = countNeisBytes(text);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
        <span>
          글자 <strong className="tabular-nums">{chars}</strong>
          <span className="text-muted"> (공백 포함)</span>
        </span>
        <span>
          바이트 <strong className="tabular-nums">{bytes}</strong>
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-brand hover:bg-brand-soft"
          aria-expanded={open}
          aria-controls={panelId}
          title="공백은 기재요령에 없어 1바이트로 계산합니다."
          onClick={() => setOpen((value) => !value)}
        >
          <Info className="size-4" aria-hidden />
          계산 기준
        </button>
      </div>
      {open ? (
        <div id={panelId} role="note" className="mt-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm leading-6 text-ink">
          <ul className="list-disc space-y-1 pl-4">
            {COUNT_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-1 text-sm leading-6 text-muted">2026학년도 초등은 이 항목에 고정 글자 수 제한이 없습니다.</p>
      )}
    </div>
  );
}
