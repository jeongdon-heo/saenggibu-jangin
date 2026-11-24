import { useState } from "react";
import { useToast } from "./Toast";
import { Button, Modal } from "./ui";
import { useAppData } from "../context/DataContext";
import { completeAi } from "../lib/ai";
import { applyGeneratedText } from "../lib/commentApply";
import { parseCommentPaste } from "../lib/commentParse";
import { CommentRulesPanel } from "./CommentRulesPanel";
import { defaultCommentRules, lengthBand } from "../lib/commentRules";
import { buildCommentPrompt, type CommentTone } from "../lib/commentPrompt";
import { copyText } from "../lib/copyText";
import { guardPrompt } from "../lib/guard";

export function CommentActions({
  subjectId,
  studentIds,
  field,
}: {
  subjectId: string;
  studentIds: string[];
  field: "draft" | "observation";
}) {
  const { data, apply, aiKey } = useAppData();
  const toast = useToast();
  const [tone, setTone] = useState<CommentTone>("plain");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const label = field === "draft" ? "평어" : "관찰기록";

  const subject = data.subjects.find((item) => item.id === subjectId);
  const band = lengthBand(data.commentRules ?? defaultCommentRules(), data.classInfo.grade, subject?.name ?? "");

  function prepared() {
    return buildCommentPrompt(data, subjectId, studentIds, tone, band.min, label);
  }

  async function generate() {
    const built = prepared();
    if (!built.ok) {
      setError(built.error);
      return;
    }
    const guarded = guardPrompt(built.data.prompt, data);
    if (!guarded.ok) {
      setError(guarded.error);
      return;
    }
    if (!aiKey.trim()) {
      setError("API 키가 없습니다. 프롬프트를 복사하거나 AI 설정에서 키를 넣어 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const text = await completeAi({ provider: data.aiSettings.provider, model: data.aiSettings.model, apiKey: aiKey, prompt: guarded.data });
      const parsed = parseCommentPaste(text, label);
      if (!parsed.ok) {
        setPaste(text);
        setPasteOpen(true);
        setError(parsed.error);
        return;
      }
      const applied = applyGeneratedText(data, subjectId, parsed.data, field);
      if (!applied.ok) setError(applied.error);
      else {
        apply(applied.data);
        toast(`${label} 초안 ${applied.applied}개를 넣었습니다. 확인 후에만 나이스에 넣으세요.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    const built = prepared();
    if (!built.ok) {
      setError(built.error);
      return;
    }
    const guarded = guardPrompt(built.data.prompt, data);
    if (!guarded.ok) {
      setError(guarded.error);
      return;
    }
    const copied = await copyText(guarded.data);
    toast(copied ? "프롬프트를 복사했습니다. 자리표시만 들어 있습니다." : "복사하지 못했습니다.");
  }

  function importPaste() {
    const parsed = parseCommentPaste(paste, label);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const applied = applyGeneratedText(data, subjectId, parsed.data, field);
    if (!applied.ok) {
      setError(applied.error);
      return;
    }
    apply(applied.data);
    setPasteOpen(false);
    setPaste("");
    setError(null);
    toast(`${label} 초안 ${applied.applied}개를 넣었습니다.`);
  }

  return (
    <section className="sheet mt-4 p-4">
      <p className="text-sm leading-6 text-warn">
        인공지능이 쓴 문장은 그대로 나이스에 넣을 수 없습니다. 2026 기재요령대로 선생님이 고치고 ‘확인 완료’를 누른 문장만 복사와 엑셀에 들어갑니다.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          문체
          <select className="control mt-1" value={tone} onChange={(event) => setTone(event.target.value as CommentTone)}>
            <option value="plain">담백하게</option>
            <option value="warm">따뜻하게</option>
          </select>
        </label>
        <p className="text-sm leading-6 text-muted">이 과목 목표 {band.min}~{band.max}자</p>
        <Button disabled={busy} onClick={() => void generate()}>
          {busy ? "만드는 중" : field === "draft" ? "이 과목 평어 초안" : "나이스 문장으로 다듬기"}
        </Button>
        <Button variant="secondary" onClick={() => void copyPrompt()}>
          프롬프트 복사
        </Button>
        <Button variant="secondary" onClick={() => setPasteOpen(true)}>
          결과 붙여넣기
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">자리표시(학생A)만 보내고, 번호·별칭·실명·학생 답은 보내지 않습니다. 돌아온 문장은 이 브라우저에서 학생에게 다시 연결합니다.</p>
      {error ? <p className="mt-3 text-sm leading-6 text-danger">{error}</p> : null}
      {field === "draft" ? <CommentRulesPanel /> : null}
      {pasteOpen ? (
        <Modal title={`${label} 결과 붙여넣기`} onClose={() => setPasteOpen(false)}>
          <textarea className="control" rows={8} value={paste} onChange={(event) => setPaste(event.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPasteOpen(false)}>
              닫기
            </Button>
            <Button onClick={importPaste}>초안으로 넣기</Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
