import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import { Button, PageHeader } from "../components/ui";
import { useAppData } from "../context/DataContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { copyText } from "../lib/copyText";
import { buildExportRows, buildExportTable, type ExportLayout } from "../lib/exportRows";
import { saveXlsxFile } from "../lib/files";
import { countLabel } from "../lib/textCount";

export function NeisPage() {
  usePageTitle("나이스 입력");
  const { data } = useAppData();
  const toast = useToast();
  const [layout, setLayout] = useState<ExportLayout>("rows");
  const rows = buildExportRows(data);

  async function copyRow(text: string) {
    const ok = await copyText(text);
    toast(ok ? "확인한 문장을 복사했습니다. 나이스에 붙여넣으세요." : "복사하지 못했습니다.");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="8단계 · 사용 가능"
        title="나이스에 입력"
        description="확인 완료된 문장만 번호 순으로 복사하거나 엑셀로 받습니다. 이 앱은 나이스에 로그인하지 않습니다."
        actions={
          <Button
            disabled={rows.length === 0}
            onClick={() => {
              saveXlsxFile(data, layout);
              toast(layout === "rows" ? "행으로 된 엑셀을 저장했습니다." : "과목 열로 된 엑셀을 저장했습니다.");
            }}
          >
            엑셀로 저장
          </Button>
        }
      />
      <fieldset className="flex gap-2">
        <label className="flex items-center gap-2 rounded-full bg-card px-3 py-2 text-sm ring-1 ring-line">
          <input type="radio" name="layout" checked={layout === "rows"} onChange={() => setLayout("rows")} />
          한 줄에 한 과목
        </label>
        <label className="flex items-center gap-2 rounded-full bg-card px-3 py-2 text-sm ring-1 ring-line">
          <input type="radio" name="layout" checked={layout === "columns"} onChange={() => setLayout("columns")} />
          과목을 가로 칸으로
        </label>
      </fieldset>
      {rows.length === 0 ? (
        <p className="sheet mt-4 px-5 py-8 text-sm leading-6 text-muted">
          확인 완료된 문장이 없습니다. <Link className="text-brand" to="/records">평어</Link> 또는 <Link className="text-brand" to="/observe">관찰기록</Link>에서 확인 완료를 눌러 주세요.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            교과 평어 {rows.filter((row) => row.kind === "교과 평어").length}개, 관찰기록 {rows.filter((row) => row.kind === "관찰기록").length}개. 실명과 메모, 확인 전 초안은 빠집니다. 관찰기록은 평어와 다른 칸입니다.
          </p>
          {layout === "columns" ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <tbody>
                  {buildExportTable(data, "columns").map((line, index) => (
                    <tr key={line.join("|")} className={index === 0 ? "font-medium" : "border-t border-line"}>
                      {line.map((cell, cellIndex) => (
                        <td key={`${index}-${cellIndex}`} className="px-2 py-2 align-top whitespace-pre-wrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {rows.map((row) => (
                <li key={`${row.number}-${row.subject}-${row.kind}`} className="sheet p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {row.number}번 {row.alias || "별칭 없음"} · {row.subject} · {row.kind}
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => void copyRow(row.draft)}>
                      문장 복사
                    </Button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap leading-7">{row.draft}</p>
                  <p className="mt-2 text-sm text-muted">{countLabel(row.draft)}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
