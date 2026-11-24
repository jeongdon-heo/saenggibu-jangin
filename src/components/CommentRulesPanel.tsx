import { useState } from "react";
import { useToast } from "./Toast";
import { Button } from "./ui";
import { useAppData } from "../context/DataContext";
import { defaultCommentRules, type CommentEndingMix, type CommentLengthRule, type CommentRules } from "../lib/commentRules";

const ENDINGS: Array<{ key: keyof CommentEndingMix; label: string }> = [
  { key: "ham", label: "~함" },
  { key: "eum", label: "~음·ㅁ" },
  { key: "can", label: "~할 수 있음" },
  { key: "im", label: "~임·보임" },
  { key: "has", label: "~있음" },
];

function digits(value: string, min: number, max: number): number {
  const number = Number(value.replace(/[^\d]/g, "") || "0");
  return Math.min(max, Math.max(min, number));
}

function WordEditor({
  label,
  hint,
  words,
  onChange,
}: {
  label: string;
  hint?: string;
  words: string[];
  onChange: (words: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const next = draft
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...words];
    for (const word of next) {
      if (!merged.includes(word)) merged.push(word.slice(0, 40));
    }
    onChange(merged.slice(0, 30));
    setDraft("");
  }
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="mt-1 text-sm leading-6 text-muted">{hint}</p> : null}
      <ul className="mt-2 flex flex-wrap gap-1">
        {words.map((word) => (
          <li key={word}>
            <button type="button" className="rounded-full bg-paper px-2 py-1 text-xs" onClick={() => onChange(words.filter((item) => item !== word))}>
              {word} <span className="text-muted">빼기</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          className="control"
          aria-label={`${label} 추가`}
          value={draft}
          placeholder="쉼표로 여러 개"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={add}>
          추가
        </Button>
      </div>
    </div>
  );
}

export function CommentRulesPanel() {
  const { data, apply } = useAppData();
  const toast = useToast();
  const rules = data.commentRules ?? defaultCommentRules();
  const endingSum = ENDINGS.reduce((sum, item) => sum + rules.endings[item.key], 0);

  function save(next: CommentRules) {
    apply({ ...data, commentRules: next });
  }

  function patch(partial: Partial<CommentRules>) {
    save({ ...rules, ...partial });
  }

  function updateLength(index: number, partial: Partial<CommentLengthRule>) {
    patch({ lengths: rules.lengths.map((row, rowIndex) => (rowIndex === index ? { ...row, ...partial } : row)) });
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
          문장 수 최소
          <input className="control mt-1" inputMode="numeric" aria-label="문장 수 최소" value={rules.sentenceMin} onChange={(event) => patch({ sentenceMin: digits(event.target.value, 1, 12) })} />
        </label>
        <label className="text-sm">
          문장 수 최대
          <input className="control mt-1" inputMode="numeric" aria-label="문장 수 최대" value={rules.sentenceMax} onChange={(event) => patch({ sentenceMax: digits(event.target.value, 1, 12) })} />
        </label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm leading-6">
        <input className="mt-1" type="checkbox" checked={rules.allowHope} onChange={(event) => patch({ allowHope: event.target.checked })} />
        <span>기대 문장 허용. 끄면 ‘앞으로 ~하기를 바람’, ‘기대됨’을 쓰지 않습니다.</span>
      </label>
      <div className="mt-4">
        <p className="text-sm font-medium">종결 비율</p>
        <p className="mt-1 text-sm leading-6 text-muted">표현함은 ~함에 넣습니다. 합이 100이 아니어도 적힌 비율대로 안내합니다. 지금 합은 {endingSum}%입니다.</p>
        <div className="mt-2 space-y-2">
          {ENDINGS.map((item) => (
            <label key={item.key} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0">{item.label}</span>
              <input
                className="min-w-0 flex-1"
                type="range"
                min={0}
                max={100}
                aria-label={`${item.label} 비율`}
                value={rules.endings[item.key]}
                onChange={(event) => patch({ endings: { ...rules.endings, [item.key]: Number(event.target.value) } })}
              />
              <span className="w-12 text-right">{rules.endings[item.key]}%</span>
            </label>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-4">
        <WordEditor label="높은 수준 말" hint="상·중·하 이름은 문장에 쓰지 않습니다." words={rules.highWords} onChange={(highWords) => patch({ highWords })} />
        <WordEditor label="중간 수준 말" words={rules.midWords} onChange={(midWords) => patch({ midWords })} />
        <WordEditor label="기초 수준 말" hint="약한 점은 노력, 과정, 보완으로 적고 미흡·부족이라고 단정하지 않습니다." words={rules.lowWords} onChange={(lowWords) => patch({ lowWords })} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          기본 글자 수 최소
          <input className="control mt-1" inputMode="numeric" aria-label="기본 글자 수 최소" value={rules.lengthMin} onChange={(event) => patch({ lengthMin: digits(event.target.value, 40, 1500) })} />
        </label>
        <label className="text-sm">
          기본 글자 수 최대
          <input className="control mt-1" inputMode="numeric" aria-label="기본 글자 수 최대" value={rules.lengthMax} onChange={(event) => patch({ lengthMax: digits(event.target.value, 40, 1500) })} />
        </label>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium">학년·과목별 글자 수</p>
        <p className="mt-1 text-sm leading-6 text-muted">학년만 적으면 그 학년 전체, 과목만 적으면 모든 학년의 그 과목입니다. 둘 다 적으면 그 조합을 우선합니다.</p>
        <ul className="mt-2 space-y-2">
          {rules.lengths.map((row, index) => (
            <li key={index} className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted">
                학년
                <input
                  className="control mt-1 w-16"
                  inputMode="numeric"
                  aria-label={`${index + 1}번째 예외 학년`}
                  value={row.grade ?? ""}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^\d]/g, "");
                    updateLength(index, { grade: raw ? Math.min(6, Math.max(1, Number(raw))) : null });
                  }}
                />
              </label>
              <label className="text-xs text-muted">
                과목
                <input className="control mt-1 w-32" aria-label={`${index + 1}번째 예외 과목`} value={row.subject} onChange={(event) => updateLength(index, { subject: event.target.value })} />
              </label>
              <label className="text-xs text-muted">
                최소
                <input className="control mt-1 w-20" inputMode="numeric" aria-label={`${index + 1}번째 예외 최소`} value={row.min} onChange={(event) => updateLength(index, { min: digits(event.target.value, 40, 1500) })} />
              </label>
              <label className="text-xs text-muted">
                최대
                <input className="control mt-1 w-20" inputMode="numeric" aria-label={`${index + 1}번째 예외 최대`} value={row.max} onChange={(event) => updateLength(index, { max: digits(event.target.value, 40, 1500) })} />
              </label>
              <Button type="button" size="sm" variant="secondary" onClick={() => patch({ lengths: rules.lengths.filter((_, rowIndex) => rowIndex !== index) })}>
                빼기
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" className="mt-2" size="sm" variant="secondary" onClick={() => patch({ lengths: [...rules.lengths, { grade: null, subject: "", min: rules.lengthMin, max: rules.lengthMax }] })}>
          글자 수 예외 추가
        </Button>
      </div>
      <div className="mt-4">
        <WordEditor label="겹치지 않게 바꿀 말" hint="학생마다 이 말을 그대로 반복하지 말라고 안내합니다." words={rules.varyWords} onChange={(varyWords) => patch({ varyWords })} />
      </div>
      <label className="mt-4 block text-sm font-medium">
        선생님 추가 규칙
        <textarea className="control mt-1" rows={4} aria-label="선생님 추가 규칙" value={rules.extra} onChange={(event) => patch({ extra: event.target.value.slice(0, 2000) })} />
      </label>
    </section>
  );
}
