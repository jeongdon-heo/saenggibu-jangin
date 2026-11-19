import { Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { BackupActions } from "../components/BackupActions";
import { useToast } from "../components/Toast";
import { Button, Field, Modal, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { createDemoData } from "../lib/defaults";
import { usePageTitle } from "../hooks/usePageTitle";
import { addStudent, applyStudents, deleteStudent, sortedStudents, updateClassInfo, updateStudent } from "../lib/model";
import { parseStudentList } from "../lib/parse";
import type { ClassInfo, Student } from "../types";

export function ClassPage() {
  usePageTitle("학급 설정");
  const { data, apply } = useAppData();
  const toast = useToast();
  const info = data.classInfo;
  const [yearText, setYearText] = useState(String(info.schoolYear));
  const [yearSource, setYearSource] = useState(info.schoolYear);
  const [yearError, setYearError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);
  if (info.schoolYear !== yearSource) {
    setYearSource(info.schoolYear);
    setYearText(String(info.schoolYear));
  }

  function saveClass(patch: Partial<ClassInfo>) {
    const result = updateClassInfo(data, patch);
    if (result.ok) apply(result.data);
    return result;
  }

  const students = sortedStudents(data.students);
  const empty = data.students.length === 0 && data.subjects.length === 0 && data.records.length === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="기초"
        title="학급 설정"
        description="학년도, 학년, 반과 학생 명단을 정합니다. 학생은 번호와 이니셜만으로 충분합니다."
      />

      <section className="sheet p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="학년도" error={yearError} hint="3월에 시작하는 학년도를 적습니다.">
            <input
              className="control"
              inputMode="numeric"
              value={yearText}
              onChange={(event) => {
                const value = event.target.value.replace(/[^\d]/g, "").slice(0, 4);
                setYearText(value);
                const year = Number(value);
                if (!value || year < 2000 || year > 2100) {
                  setYearError("2000년부터 2100년 사이로 입력해 주세요.");
                  return;
                }
                setYearError(null);
                saveClass({ schoolYear: year });
              }}
            />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">학기</legend>
            <div className="flex gap-2">
              {[1, 2].map((semester) => (
                <label key={semester} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-white text-sm">
                  <input
                    type="radio"
                    name="semester"
                    checked={info.semester === semester}
                    onChange={() => saveClass({ semester: semester as 1 | 2 })}
                  />
                  {semester}학기
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="학년">
            <select
              className="control"
              value={info.grade ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                saveClass({ grade: value === "" ? null : Number(value) });
              }}
            >
              <option value="">학년 선택</option>
              {[1, 2, 3, 4, 5, 6].map((grade) => (
                <option key={grade} value={grade}>
                  {grade}학년
                </option>
              ))}
            </select>
          </Field>
          <Field label="반" hint="숫자만 적으면 1반처럼 보입니다. 해님반처럼 적어도 됩니다.">
            <input
              className="control"
              maxLength={20}
              placeholder="예: 1"
              value={info.classLabel}
              onChange={(event) => saveClass({ classLabel: event.target.value.slice(0, 20) })}
            />
          </Field>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          이 브라우저에는 학급 하나 분만 저장됩니다. 다른 학급을 시작하려면 먼저 백업 파일을 저장한 뒤 데이터를 지우세요. 학기 이름은 이름표일 뿐, 바꾸면 이전 학기 기록이 따로 보관되지 않습니다.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">학생 명단</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          실명은 적지 않는 것을 권합니다. 실명을 적더라도 이 브라우저 밖에 나가지 않으며, 엑셀 파일에는 넣지 않습니다.
        </p>
        <AddStudentForm />
        {students.length === 0 ? (
          <p className="sheet mt-4 px-5 py-8 text-center text-sm leading-6 text-muted">
            아직 학생이 없습니다. 위에서 한 명씩 넣거나, 번호 목록을 붙여넣으세요.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {students.map((student) => (
              <StudentRow key={student.id} student={student} onDelete={() => setPendingDelete(student)} />
            ))}
          </ul>
        )}
        <PasteStudents />
        {empty ? (
          <button
            type="button"
            className="mt-4 text-sm font-medium text-brand"
            onClick={() => {
              apply(createDemoData(data.classInfo));
              toast("예시 학급을 넣었습니다.");
            }}
          >
            예시 학급으로 둘러보기
          </button>
        ) : null}
      </section>

      <section className="sheet mt-8 p-5 sm:p-6">
        <h2 className="text-lg font-bold">백업과 삭제</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          백업 파일은 JSON입니다. 실명과 관찰 메모까지 들어 있으니 개인 폴더에 보관하세요. 컴퓨터를 바꾸려면 이 파일을 불러오면 됩니다.
        </p>
        <div className="mt-4">
          <BackupActions />
        </div>
      </section>

      {pendingDelete ? (
        <Modal title="명단에서 뺄까요?" onClose={() => setPendingDelete(null)}>
          <p>
            {pendingDelete.number}번 {pendingDelete.alias || "별칭 없음"} 학생을 뺍니다. 적어 둔 메모와 문장도 함께 지워집니다.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={() => setPendingDelete(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                apply(deleteStudent(data, pendingDelete.id));
                setPendingDelete(null);
              }}
            >
              빼기
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AddStudentForm() {
  const { data, apply } = useAppData();
  const [numberText, setNumberText] = useState("");
  const [alias, setAlias] = useState("");
  const [realName, setRealName] = useState("");
  const [showRealName, setShowRealName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const result = addStudent(data, { number: Number(numberText), alias, realName: showRealName ? realName : "" });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    apply(result.data);
    setNumberText("");
    setAlias("");
    setRealName("");
    setError(null);
  }

  return (
    <form
      className="sheet mt-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <Field label="번호" error={error}>
          <input className="control" inputMode="numeric" value={numberText} onChange={(event) => setNumberText(event.target.value.replace(/[^\d]/g, "").slice(0, 3))} />
        </Field>
        <Field label="이니셜 / 별칭" hint="예: ㄱㄴ, 민. 실명 대신 짧게 적으세요.">
          <input className="control" maxLength={40} value={alias} onChange={(event) => setAlias(event.target.value)} />
        </Field>
        <Button type="submit" className="sm:mb-7">
          추가
        </Button>
      </div>
      <button type="button" className="mt-3 text-sm text-muted underline-offset-2 hover:underline" onClick={() => setShowRealName((value) => !value)}>
        {showRealName ? "실명 칸 접기" : "실명을 꼭 적어야 한다면"}
      </button>
      {showRealName ? (
        <div className="mt-3 max-w-sm">
          <Field label="실명 (선택)" hint="권하지 않습니다. 비워 두어도 됩니다.">
            <input className="control" maxLength={40} value={realName} onChange={(event) => setRealName(event.target.value)} />
          </Field>
        </div>
      ) : null}
    </form>
  );
}

function StudentRow({ student, onDelete }: { student: Student; onDelete: () => void }) {
  const { data, apply } = useAppData();
  const [numberText, setNumberText] = useState(String(student.number));
  const [numberSource, setNumberSource] = useState(student.number);
  const [error, setError] = useState<string | null>(null);
  const [showRealName, setShowRealName] = useState(student.realName.length > 0);
  if (student.number !== numberSource) {
    setNumberSource(student.number);
    setNumberText(String(student.number));
  }

  function commit(patch: Partial<Pick<Student, "number" | "alias" | "realName">>) {
    const result = updateStudent(data, student.id, patch);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    apply(result.data);
  }

  return (
    <li className="sheet p-4">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <Field label="번호" error={error}>
          <input
            className="control"
            inputMode="numeric"
            aria-label={`${student.number}번 번호`}
            value={numberText}
            onChange={(event) => setNumberText(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            onBlur={() => {
              const number = Number(numberText);
              if (number === student.number) return;
              const result = updateStudent(data, student.id, { number });
              if (!result.ok) {
                setError(result.error);
                setNumberText(String(student.number));
                return;
              }
              setError(null);
              apply(result.data);
            }}
          />
        </Field>
        <Field label="이니셜 / 별칭">
          <input
            className="control"
            maxLength={40}
            aria-label={`${student.number}번 별칭`}
            value={student.alias}
            onChange={(event) => {
              const value = event.target.value;
              apply((current) => {
                const result = updateStudent(current, student.id, { alias: value });
                return result.ok ? result.data : current;
              });
            }}
            onBlur={(event) => commit({ alias: event.target.value.trim() })}
          />
        </Field>
        <Button variant="danger" size="sm" className="sm:mb-1" onClick={onDelete} aria-label={`${student.number}번 삭제`}>
          <Trash className="size-4" aria-hidden />
          삭제
        </Button>
      </div>
      <button type="button" className="mt-2 text-sm text-muted" onClick={() => setShowRealName((value) => !value)}>
        {showRealName || student.realName ? "실명 수정" : "실명 입력 (선택)"}
      </button>
      {showRealName ? (
        <div className="mt-2 max-w-sm">
          <input
            className="control"
            maxLength={40}
            aria-label={`${student.number}번 실명`}
            placeholder="비워 두어도 됩니다"
            value={student.realName}
            onChange={(event) => {
              const value = event.target.value;
              apply((current) => {
                const result = updateStudent(current, student.id, { realName: value });
                return result.ok ? result.data : current;
              });
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

function PasteStudents() {
  const { data, apply } = useAppData();
  const [text, setText] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const parsed = useMemo(() => (text.trim() ? parseStudentList(text) : { rows: [], errors: [] }), [text]);
  const hasRealName = parsed.rows.some((row) => row.realName.trim().length > 0);

  function applyRows(mode: "append" | "replace") {
    const result = applyStudents(data, parsed.rows, mode);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setText("");
    setConfirmReplace(false);
    setMessage(mode === "replace" ? "명단을 바꿨습니다." : "명단에 반영했습니다. 같은 번호는 별칭을 고칩니다.");
  }

  return (
    <details className="sheet mt-4 p-4">
      <summary className="cursor-pointer text-sm font-medium">번호 목록 붙여넣기</summary>
      <p className="mt-3 text-sm leading-6 text-muted">
        한 줄에 한 명입니다. 예: <span className="text-ink">1 ㄱㄴ</span>. 쉼표나 탭으로 나누면 별칭과 실명을 구분하지만, 실명은 비우는 것을 권합니다.
      </p>
      <textarea
        className="control mt-3"
        rows={6}
        value={text}
        placeholder={"1 ㄱㄴ\n2 ㄷㄹ\n3"}
        onChange={(event) => {
          setText(event.target.value);
          setMessage(null);
        }}
      />
      {parsed.errors.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-danger">
          {parsed.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {parsed.rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">번호</th>
                <th className="py-1 pr-3 font-medium">별칭</th>
                {hasRealName ? <th className="py-1 font-medium">실명</th> : null}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row) => (
                <tr key={row.number} className="border-t border-line">
                  <td className="py-1.5 pr-3 tabular-nums">{row.number}</td>
                  <td className="py-1.5 pr-3">{row.alias || "없음"}</td>
                  {hasRealName ? <td className="py-1.5">{row.realName}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          {hasRealName ? <p className="mt-2 text-sm text-warn">실명이 들어 있습니다. 가능하면 별칭만 남기세요.</p> : null}
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={parsed.rows.length === 0} onClick={() => applyRows("append")}>
          명단에 추가
        </Button>
        <Button variant="secondary" disabled={parsed.rows.length === 0} onClick={() => setConfirmReplace(true)}>
          이 명단으로 바꾸기
        </Button>
      </div>
      {confirmReplace ? (
        <Modal title="명단을 바꿀까요?" onClose={() => setConfirmReplace(false)}>
          <p>같은 번호의 메모는 남습니다. 목록에서 빠진 번호와 그 메모는 지워집니다.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" autoFocus onClick={() => setConfirmReplace(false)}>
              취소
            </Button>
            <Button onClick={() => applyRows("replace")}>바꾸기</Button>
          </div>
        </Modal>
      ) : null}
    </details>
  );
}
