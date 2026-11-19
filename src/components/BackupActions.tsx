import { Download, Trash, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAppData } from "../context/DataContext";
import { downloadTextFile } from "../lib/download";
import { saveBackupFile } from "../lib/files";
import { classSummary } from "../lib/format";
import { parseBackup } from "../lib/storage";
import { LIMITS } from "../lib/limits";
import type { AppData } from "../types";
import { useToast } from "./Toast";
import { Button, cx, Modal } from "./ui";

function describe(data: AppData): string {
  const summary = classSummary(data.classInfo);
  return `${summary ?? "학급 정보가 없는 백업"} · 학생 ${data.students.length}명 · 과목 ${data.subjects.length}개 · 기록 ${data.records.length}개`;
}

export function BackupActions({ compact = false }: { compact?: boolean }) {
  const { data, replaceAll, startFresh } = useAppData();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > LIMITS.backupChars) {
      setError("파일이 너무 큽니다.");
      return;
    }
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending(result.data);
  }

  return (
    <div className={cx("flex gap-2", compact ? "flex-col" : "flex-col sm:flex-row sm:flex-wrap")}>
      <Button
        variant="secondary"
        size={compact ? "sm" : "md"}
        className={compact ? "w-full justify-start" : undefined}
        onClick={() => {
          saveBackupFile(data);
          toast("백업 파일을 저장했습니다. 공유 폴더보다 개인 폴더에 두세요.");
        }}
      >
        <Download className="size-4" aria-hidden />
        백업 파일 저장
      </Button>
      <Button
        variant="secondary"
        size={compact ? "sm" : "md"}
        className={compact ? "w-full justify-start" : undefined}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" aria-hidden />
        백업 파일 불러오기
      </Button>
      <Button
        variant="danger"
        size={compact ? "sm" : "md"}
        className={compact ? "w-full justify-start" : undefined}
        onClick={() => setConfirmClear(true)}
      >
        <Trash className="size-4" aria-hidden />
        모든 데이터 지우기
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFile(file);
        }}
      />

      {pending ? (
        <Modal title="이 백업으로 바꿀까요?" onClose={() => setPending(null)}>
          <p>{describe(pending)}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            지금 이 화면에 있는 내용은 사라집니다. 백업 파일에는 실명과 관찰 메모가 들어 있을 수 있으니 그 파일은 개인 폴더에 두세요.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={() => setPending(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                replaceAll(pending);
                setPending(null);
                toast("백업을 불러왔습니다.");
              }}
            >
              불러오기
            </Button>
          </div>
        </Modal>
      ) : null}

      {error ? (
        <Modal title="파일을 불러오지 못했습니다" onClose={() => setError(null)}>
          <p>{error}</p>
          <div className="mt-5 flex justify-end">
            <Button autoFocus onClick={() => setError(null)}>
              확인
            </Button>
          </div>
        </Modal>
      ) : null}

      {confirmClear ? (
        <Modal title="모든 데이터를 지울까요?" onClose={() => setConfirmClear(false)}>
          <p>
            학생 {data.students.length}명, 과목 {data.subjects.length}개, 기록 {data.records.length}개가 이 브라우저에서 삭제됩니다.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">백업 파일을 저장하지 않았다면 되돌릴 수 없습니다.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={() => setConfirmClear(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                startFresh();
                setConfirmClear(false);
                toast("모든 데이터를 지웠습니다.");
              }}
            >
              모두 지우기
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function RecoverGate() {
  const { recovering, corruptRaw, replaceAll, startFresh } = useAppData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  if (!recovering) return null;

  return (
    <Modal title="저장된 기록을 읽지 못했습니다" onClose={() => {}} locked>
      <p>이 브라우저에 있던 기록을 열 수 없습니다. 새 내용을 쓰기 전에 어떻게 할지 골라 주세요.</p>
      {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
      <div className="mt-5 flex flex-col gap-2">
        <Button
          variant="secondary"
          disabled={!corruptRaw}
          onClick={() => {
            if (!corruptRaw) return;
            downloadTextFile("생기부장인_읽지못함.json", corruptRaw, "application/json");
          }}
        >
          읽지 못한 내용 내려받기
        </Button>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          백업 파일 불러오기
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            startFresh();
          }}
        >
          지우고 새로 시작
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void file.text().then((text) => {
            const result = parseBackup(text);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            replaceAll(result.data);
          });
        }}
      />
      <p className="mt-4 text-sm leading-6 text-muted">새로 시작하면 읽지 못한 저장은 빈 학급으로 바뀝니다. 가능하면 먼저 내려받아 두세요.</p>
    </Modal>
  );
}
