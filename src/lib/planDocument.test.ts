import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { emptyData } from "./defaults";
import { guardPrompt } from "./guard";
import { addSubject } from "./model";
import { applyPlanSelections } from "./planApply";
import { HWP_UNSUPPORTED, readPlanFile } from "./planDocument";
import { buildPlanPrompt, parsePlanAiResponse } from "./planPrompt";
import type { Unit } from "../types";

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function cell(text: string, col: number, row: number, colSpan = 1): string {
  return `<hp:tc><hp:subList><hp:p><hp:run><hp:t>${escapeXml(text)}</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="${col}" rowAddr="${row}"/><hp:cellSpan colSpan="${colSpan}" rowSpan="1"/></hp:tc>`;
}

function table(rows: string[][]): string {
  const body = rows
    .map(
      (row, rowIndex) =>
        `<hp:tr>${row.map((text, colIndex) => cell(text, colIndex, rowIndex, row.length === 1 ? 4 : 1)).join("")}</hp:tr>`,
    )
    .join("");
  return `<hp:p><hp:run><hp:tbl>${body}</hp:tbl></hp:run></hp:p>`;
}

function paragraph(text: string): string {
  return `<hp:p><hp:run><hp:t>${escapeXml(text)}</hp:t></hp:run></hp:p>`;
}

function hwpx(parts: string[]): Uint8Array {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">${parts.join("")}</hs:sec>`;
  return zipSync({ "Contents/section0.xml": strToU8(xml) });
}

function sampleHwpx(): Uint8Array {
  return hwpx([
    paragraph("4학년 국어 평가계획"),
    paragraph("[4국02-01] 글을 읽고 중심 생각을 파악한다."),
    table([
      ["평가 계획"],
      ["영역", "평가 내용", "방법", "반영 비율"],
      ["읽기", "중심 생각을 파악한다", "관찰", "30%"],
    ]),
    table([
      ["단원", "평가요소", "성취기준", "잘함", "보통", "노력요함"],
      ["2. 이야기를 간추려요", "중심 내용", "[4국02-01]", "자신의 말로 설명한다", "일부를 말한다", "찾기 어려워한다"],
    ]),
    paragraph("수학"),
    table([
      ["영역", "평가 내용", "방법", "반영 비율"],
      ["수와 연산", "세 자리 수의 덧셈", "지필", "40%"],
    ]),
    table([
      ["평가요소", "성취기준", "상", "중", "하"],
      ["덧셈", "[4수01-01] 세 자리 수를 더한다.", "받아올림이 정확하다", "가끔 실수한다", "계산이 어렵다"],
    ]),
  ]);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function pdfObjects(objects: string[]): Uint8Array {
  let body = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = byteLength(body);
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  body += `${table}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

function koreanPdf(lines: Array<Array<{ x: number; y: number; text: string }>>): Uint8Array {
  const chars: string[] = [];
  const codesFor = (text: string) => {
    let hex = "";
    for (const char of text) {
      let index = chars.indexOf(char);
      if (index < 0) {
        chars.push(char);
        index = chars.length - 1;
      }
      hex += (index + 1).toString(16).padStart(4, "0");
    }
    return hex;
  };
  const commands = ["BT", "/F1 12 Tf"];
  for (const line of lines) {
    for (const item of line) commands.push(`1 0 0 1 ${item.x} ${item.y} Tm <${codesFor(item.text)}> Tj`);
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const mapping = chars
    .map((char, index) => `<${(index + 1).toString(16).padStart(4, "0")}> <${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}>`)
    .join("\n");
  const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chars.length} beginbfchar\n${mapping}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
  return pdfObjects([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /KTest /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 8 0 R >>",
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /KTest /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /DW 1000 /CIDToGIDMap /Identity >>",
    "<< /Type /FontDescriptor /FontName /KTest /Flags 4 /FontBBox [0 0 1000 1000] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
    `<< /Length ${byteLength(cmap)} >>\nstream\n${cmap}\nendstream`,
  ]);
}

describe("평가계획 HWPX", () => {
  it("전과목 문서에서 평가계획, 성취기준, 평가요소를 과목별로 나눈다", async () => {
    const result = await readPlanFile("평가계획.hwpx", sampleHwpx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings.some((warning) => warning.includes("여러 개"))).toBe(true);
    const korean = result.data.subjects.find((subject) => subject.name === "국어");
    const math = result.data.subjects.find((subject) => subject.name === "수학");
    expect(korean?.plan[0]).toMatchObject({ area: "읽기", content: "중심 생각을 파악한다", method: "관찰", ratio: "30%" });
    expect(korean?.standards[0]).toMatchObject({ code: "4국02-01", text: "글을 읽고 중심 생각을 파악한다." });
    expect(korean?.elements[0]).toMatchObject({
      name: "중심 내용",
      unitTitle: "2. 이야기를 간추려요",
      standardCodes: ["4국02-01"],
    });
    expect(korean?.elements[0]?.levels.map((level) => level.label)).toEqual(["잘함", "보통", "노력요함"]);
    expect(math?.plan[0]?.content).toBe("세 자리 수의 덧셈");
    expect(math?.elements[0]?.levels.map((level) => [level.label, level.description])).toEqual([
      ["상", "받아올림이 정확하다"],
      ["중", "가끔 실수한다"],
      ["하", "계산이 어렵다"],
    ]);
    expect(math?.standards.some((standard) => standard.code === "4수01-01" && standard.text.includes("세 자리"))).toBe(true);
  });

  it("세로로 이어진 수준 기준을 한 평가요소로 모은다", async () => {
    const bytes = hwpx([
      paragraph("과학"),
      table([
        ["단원", "평가요소", "성취기준", "수준", "기준"],
        ["1. 자석", "자석의 성질", "[4과02-01]", "잘함", "극을 구분해 말한다"],
        ["", "", "", "보통", "붙는 현상만 말한다"],
        ["", "", "", "노력요함", "관찰이 어렵다"],
      ]),
    ]);
    const result = await readPlanFile("과학.hwpx", bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const subject = result.data.subjects[0];
    expect(subject?.name).toBe("과학");
    expect(subject?.elements).toHaveLength(1);
    expect(subject?.elements[0]?.levels).toEqual([
      { label: "잘함", description: "극을 구분해 말한다" },
      { label: "보통", description: "붙는 현상만 말한다" },
      { label: "노력요함", description: "관찰이 어렵다" },
    ]);
  });

  it("일부만 알아보면 안내를 남긴다", async () => {
    const bytes = hwpx([paragraph("[4국01-01] 대화의 즐거움을 알고 대화를 나눈다.")]);
    const result = await readPlanFile("일부.hwpx", bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const warnings = result.data.subjects[0]?.warnings.join(" ") ?? "";
    expect(warnings).toContain("평가계획 행을 찾지 못했습니다");
    expect(warnings).toContain("평가요소를 찾지 못했습니다");
    expect(warnings).toContain("일부만 알아봤습니다");
    expect(result.data.subjects[0]?.standards[0]?.code).toBe("4국01-01");
  });

  it("예전 hwp는 저장 방법을 안내하고, 빈 글자는 스캔 안내를 한다", async () => {
    const hwp = await readPlanFile("계획.hwp", new Uint8Array([1, 2, 3]));
    expect(hwp.ok).toBe(false);
    if (hwp.ok) return;
    expect(hwp.error).toBe(HWP_UNSUPPORTED);
    const empty = await readPlanFile("빈.pdf", koreanPdf([[{ x: 40, y: 700, text: "가" }]]));
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.data.warnings.some((warning) => warning.includes("글자가 거의 없습니다"))).toBe(true);
  });
});

describe("평가계획 PDF", () => {
  it("글자 위치로 표의 칸을 나누고 성취기준 문장도 읽는다", async () => {
    const bytes = koreanPdf([
      [
        { x: 40, y: 720, text: "국어" },
      ],
      [
        { x: 40, y: 680, text: "영역" },
        { x: 160, y: 680, text: "평가 내용" },
        { x: 340, y: 680, text: "방법" },
        { x: 460, y: 680, text: "반영 비율" },
      ],
      [
        { x: 40, y: 650, text: "읽기" },
        { x: 160, y: 650, text: "중심 생각을 파악한다" },
        { x: 340, y: 650, text: "관찰" },
        { x: 460, y: 650, text: "30%" },
      ],
      [{ x: 40, y: 600, text: "[4국02-01] 글을 읽고 중심 생각을 파악한다." }],
    ]);
    const result = await readPlanFile("계획.pdf", bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.subjects[0]?.name).toBe("국어");
    expect(result.data.subjects[0]?.plan[0]).toMatchObject({
      area: "읽기",
      content: "중심 생각을 파악한다",
      method: "관찰",
      ratio: "30%",
    });
    expect(result.data.subjects[0]?.standards[0]?.code).toBe("4국02-01");
  });
});

describe("평가계획 넣기", () => {
  it("같은 평가 항목, 성취기준, 평가요소는 다시 만들지 않고 빈칸만 채운다", () => {
    const created = addSubject(emptyData(), "국어");
    expect(created.ok).toBe(true);
    if (!created.ok || !created.id) return;
    const unit: Unit = {
      id: "unit-1",
      order: 1,
      grade: 4,
      semester: 2,
      organization: "국어",
      title: "2. 이야기를 간추려요",
      content: "",
      pages: "",
      extraPages: "",
      period: "",
      totalPeriods: "",
      materials: "",
      skipped: false,
      elementId: "",
    };
    const subjectId = created.id;
    const seeded = {
      ...created.data,
      subjects: created.data.subjects.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              units: [unit],
              plan: [{ id: "plan-1", area: "읽기", content: "중심 생각을 파악한다", method: "관찰", ratio: "", note: "" }],
              standards: [{ id: "std-1", code: "4국02-01", text: "짧은 문장" }],
              elements: [{ id: "el-1", name: "중심 내용", unitId: "", standardCodes: [], levels: [], note: "" }],
            }
          : subject,
      ),
    };
    const applied = applyPlanSelections(seeded, [
      {
        subjectId,
        createName: "",
        plan: [{ area: "읽기", content: "중심 생각을 파악한다", method: "관찰", ratio: "30%", note: "" }],
        standards: [{ code: "4국02-01", text: "글을 읽고 중심 생각을 파악한다." }, { code: "4국02-02", text: "내용을 간추린다." }],
        elements: [
          {
            name: "중심 내용",
            unitTitle: "이야기를 간추려요",
            standardCodes: ["4국02-01"],
            levels: [{ label: "잘함", description: "자신의 말로 설명한다" }],
            note: "",
          },
          {
            name: "다른 요소",
            unitTitle: "없는 단원",
            standardCodes: [],
            levels: [],
            note: "",
          },
        ],
      },
    ]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const subject = applied.data.subjects[0];
    expect(subject?.plan).toHaveLength(1);
    expect(subject?.plan[0]?.ratio).toBe("30%");
    expect(subject?.standards.map((item) => item.code)).toEqual(["4국02-01", "4국02-02"]);
    expect(subject?.standards[0]?.text).toBe("글을 읽고 중심 생각을 파악한다.");
    expect(subject?.elements).toHaveLength(2);
    expect(subject?.elements[0]?.unitId).toBe("unit-1");
    expect(subject?.elements[0]?.note).toBe("");
    expect(subject?.elements[1]?.unitId).toBe("");
    expect(subject?.elements[1]?.note).toBe("단원: 없는 단원");
    expect(subject?.elements[0]?.levels[0]?.description).toBe("자신의 말로 설명한다");
    expect(applied.addedPlan).toBe(0);
    expect(applied.addedElements).toBe(1);
    expect(applied.addedStandards).toBe(1);
  });
});

describe("평가계획 AI 정리", () => {
  it("JSON 응답을 검토용 항목으로 읽고, 보낼 글에 문서가 들어 있으면 학생 이름을 막는다", () => {
    const parsed = parsePlanAiResponse(`\`\`\`json
{"subjects":[{"name":"사회","plan":[{"area":"지리","content":"지도 읽기","method":"수행","ratio":"20%","note":""}],"standards":[{"code":"[4사01-02]","text":"지도를 읽는다."}],"elements":[{"name":"지도","unitTitle":"1. 우리 지역","standardCodes":["4사01-02"],"levels":[{"label":"잘함","description":"범례를 사용한다"}],"note":""}]}]}
\`\`\``);
    expect("subjects" in parsed).toBe(true);
    if (!("subjects" in parsed)) return;
    expect(parsed.subjects[0]?.standards[0]?.code).toBe("4사01-02");
    expect(parsed.subjects[0]?.elements[0]?.levels[0]?.label).toBe("잘함");
    const data = emptyData();
    data.students = [{ id: "s1", number: 1, alias: "길동이", realName: "홍길동" }];
    const prompt = buildPlanPrompt("사회 평가계획\n길동이가 지도를 읽는다.");
    expect(prompt.prompt).toContain("사회 평가계획");
    const guarded = guardPrompt(prompt.prompt, data);
    expect(guarded.ok).toBe(false);
  });
});
