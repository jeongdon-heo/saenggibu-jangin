import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { emptyData } from "./defaults";
import grade4Glyphs from "./fixtures/grade4-plan-glyphs.json";
import grade4Term2 from "./fixtures/grade4-term2-plan.json";
import { guardPrompt } from "./guard";
import { addSubject } from "./model";
import { layoutPlanTable } from "./pdfTable";
import type { PdfGlyph } from "./pdfRead";
import { applyPlanSelections } from "./planApply";
import { lessonTopics, levelLabels } from "./teacherAssess";
import { HWP_UNSUPPORTED, interpretPlan, planImportTarget, readPlanFile } from "./planDocument";
import { buildPlanPrompt, parsePlanAiResponse } from "./planPrompt";
import { subjectFromCode } from "./subjectCode";
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
    expect(subject?.elements[1]?.unitId).not.toBe("");
    expect(subject?.units.find((unit) => unit.title === "없는 단원")).toBeTruthy();
    expect(subject?.elements[1]?.note).toBe("");
    expect(subject?.elements[0]?.levels[0]?.description).toBe("자신의 말로 설명한다");
    expect(applied.addedPlan).toBe(0);
    expect(applied.addedElements).toBe(1);
    expect(applied.addedStandards).toBe(1);
  });
});

describe("과목별 나누기", () => {
  it("성취기준 코드의 과목 글자로 어느 학년이나 과목을 가른다", () => {
    expect(subjectFromCode("4국02-01")).toBe("국어");
    expect(subjectFromCode("[6수01-03]")).toBe("수학");
    expect(subjectFromCode("4사09-01")).toBe("사회");
    expect(subjectFromCode("5과02-01")).toBe("과학");
    expect(subjectFromCode("4도01-01")).toBe("도덕");
    expect(subjectFromCode("3영01-02")).toBe("영어");
    expect(subjectFromCode("4음01-01")).toBe("음악");
    expect(subjectFromCode("2미01-01")).toBe("미술");
    expect(subjectFromCode("4체01-01")).toBe("체육");
    expect(subjectFromCode("6실02-01")).toBe("실과");
  });

  it("등록된 과목이 없어도 이름마다 새 과목으로 잡는다", () => {
    expect(planImportTarget("국어", [])).toBe("__create__");
    expect(planImportTarget("수학", [{ id: "m", name: "수학" }])).toBe("m");
    expect(planImportTarget("", [])).toBe("");
  });

  it("한 표 안의 과목 칸과 성취기준 코드로 과목마다 나눈다", () => {
    const plan = interpretPlan([
      {
        kind: "table",
        rows: [
          ["과목", "단원", "평가요소", "영역", "시기", "평가방법", "성취기준", "상", "중", "하"],
          ["국어", "1. 읽기", "중심 내용", "읽기", "9월 1주", "관찰", "[4국02-01] 글을 읽고 중심 생각을 파악한다.", "잘 찾는다", "일부를 말한다", "어려워한다"],
          ["", "", "의견 비교", "읽기", "", "토의", "[4국01-06] 주제에 알맞은 의견을 말한다.", "이유를 말한다", "일부만 말한다", "어려워한다"],
          ["수학", "1. 분수", "덧셈", "수와 연산", "10월", "지필", "[4수01-01] 세 자리 수를 더한다.", "받아올림이 정확하다", "가끔 실수한다", "계산이 어렵다"],
        ],
      },
    ]);
    const korean = plan.subjects.find((subject) => subject.name === "국어");
    const math = plan.subjects.find((subject) => subject.name === "수학");
    expect(korean?.plan.map((item) => item.content)).toEqual(["중심 내용", "의견 비교"]);
    expect(korean?.plan[0]?.note).toBe("9월 1주");
    expect(korean?.plan[0]?.ratio).toBe("");
    expect(korean?.standards[0]).toMatchObject({ code: "4국02-01", text: "글을 읽고 중심 생각을 파악한다." });
    expect(korean?.elements[0]?.levels.map((level) => level.label)).toEqual(["상", "중", "하"]);
    expect(korean?.elements[0]?.unitTitle).toBe("1. 읽기");
    expect(math?.plan[0]?.content).toBe("덧셈");
    expect(math?.standards[0]?.code).toBe("4수01-01");
  });

  it("실제 4학년 평가계획 PDF에서 따온 글자 위치로 국어 첫 행을 읽는다", () => {
    const glyphs = grade4Glyphs as PdfGlyph[];
    const table = layoutPlanTable([glyphs]);
    expect(table).not.toBeNull();
    const plan = interpretPlan([{ kind: "table", rows: table ?? [] }]);
    const korean = plan.subjects.find((subject) => subject.name === "국어");
    expect(korean?.plan[0]).toMatchObject({
      area: "읽기",
      method: "토의·토론 평가",
      ratio: "",
    });
    expect(korean?.plan[0]?.content).toContain("책을 읽고");
    expect(korean?.plan[0]?.content).toContain("글쓴이");
    expect(korean?.plan[0]?.note).toContain("9월");
    const standard = korean?.standards.find((item) => item.code === "4국02-04")?.text ?? "";
    expect(standard).toContain("글에 나타난");
    expect(standard).toContain("사실과 의견");
    expect(standard).toContain("비교한다");
    expect(korean?.elements[0]?.levels.find((level) => level.label === "상")?.description).toContain("올바르게");
    expect(korean?.elements[0]?.unitTitle).toContain("독서");
  });
});

function pdfBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

describe("4학년 2학기 수행평가 계획", () => {
  it("쪽 경계에서 잘린 칸을 잇고 꼬리말과 문항수를 맞춘다", async () => {
    const result = await readPlanFile("4학년-2학기.pdf", pdfBytes(grade4Term2.base64));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byName = Object.fromEntries(result.data.subjects.map((subject) => [subject.name, subject]));
    expect(byName["국어"]?.plan).toHaveLength(16);
    expect(byName["사회"]?.plan).toHaveLength(12);
    expect(byName["도덕"]?.plan).toHaveLength(8);
    expect(byName["수학"]?.plan).toHaveLength(18);
    expect(byName["과학"]?.plan).toHaveLength(15);
    expect(byName["체육"]?.plan).toHaveLength(17);
    expect(byName["음악"]?.plan).toHaveLength(13);
    expect(byName["미술"]?.plan).toHaveLength(5);
    expect(byName["영어"]?.plan).toHaveLength(21);
    for (const subject of result.data.subjects) {
      expect(subject.elements).toHaveLength(subject.plan.length);
      for (const item of subject.elements) expect(item.unitTitle).not.toMatch(/\d+\s*월/);
    }
    expect(result.data.warnings.some((warning) => warning.includes("문서 하단"))).toBe(false);
    const text = JSON.stringify(result.data);
    expect(text).not.toContain("문항수");
    expect(text).not.toContain("▣");
    expect(text).not.toContain("수있다");
    expect(text).not.toContain("된후의");
    expect(text).toContain("프로젝트 평가");
    expect(text).toContain("꺾은선그래프");
    expect(text).toContain("사실과 의견");
    expect(text).toContain("통일이 된 후의");

    const health = byName["체육"]?.elements.find((item) => item.name.includes("운동과 건강"));
    expect(health?.levels.find((level) => level.label === "상")?.description).toContain("영향을 설명할 수 있다.");
    const fitness = byName["체육"]?.elements.find((item) => item.name.includes("자신의 체격"));
    expect(fitness?.levels.find((level) => level.label === "상")?.description.startsWith("자신의 체격")).toBe(true);
    const sport = byName["체육"]?.elements.find((item) => item.name.includes("스포츠에 흥미"));
    const sportHigh = sport?.levels.find((level) => level.label === "상")?.description ?? "";
    expect(sportHigh.startsWith("다양한 움직임 기술의 원리와 기본")).toBe(true);
    expect(sportHigh.endsWith("참여할 수 있다.")).toBe(true);
    const dmz = byName["도덕"]?.elements.find((item) => item.name.includes("비무장") && item.name.includes("보존"));
    expect(dmz?.name).toBe("비무장 지대가 중요한 까닭을 알고 통일이 된 후의 보존 방향 알아보기");
    expect(dmz?.levels.find((level) => level.label === "상")?.description.endsWith("설명할 수 있다.")).toBe(true);
    const levels = result.data.subjects.flatMap((subject) => subject.elements.flatMap((item) => item.levels));
    const unfinished = levels.filter((level) => level.description.trim() && !/(?:다|요|까)\.?$/.test(level.description.trim()));
    expect(unfinished).toEqual([]);

    const created = addSubject(emptyData(), "국어");
    expect(created.ok).toBe(true);
    if (!created.ok || !created.id) return;
    const applied = applyPlanSelections(created.data, [
      {
        subjectId: created.id,
        createName: "",
        plan: [],
        standards: [],
        elements: byName["국어"]?.elements.slice(0, 1) ?? [],
      },
    ]);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const linked = applied.data.subjects[0]?.elements[0];
    const unit = applied.data.subjects[0]?.units.find((item) => item.id === linked?.unitId);
    expect(unit?.title).toContain("생각을 나누며 책을 읽어요");
    expect(unit?.title).not.toMatch(/\d+\s*월/);
    expect(linked?.note ?? "").not.toContain("단원:");
  });

  it("평가 항목마다 교사 평가 열을 만들고 잘린 단원을 붙인다", async () => {
    const result = await readPlanFile("4학년-2학기.pdf", pdfBytes(grade4Term2.base64));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = JSON.stringify(result.data);
    expect(text).not.toContain("필요 성");
    expect(text).not.toContain("해결 하기");
    expect(text).not.toContain("조사 하고");
    expect(text).toContain("필요성");
    expect(text).toContain("해결하기");
    expect(text).toContain("조사하고");
    const moral = result.data.subjects.find((subject) => subject.name === "도덕");
    const dmz = moral?.elements.filter((item) => item.name.includes("비무장")) ?? [];
    expect(dmz.length).toBeGreaterThan(1);
    expect(dmz.every((item) => item.unitTitle.includes("비무장") && item.unitTitle.includes("생명의 땅"))).toBe(true);
    expect(result.data.subjects.flatMap((subject) => subject.elements.map((item) => item.unitTitle)).some((title) => title === "말릴까 얼릴까?")).toBe(false);
    expect(result.data.subjects.some((subject) => subject.elements.some((item) => /\d+\.\s+\S.*\s\d+(?:-\d+)?\./.test(item.unitTitle)))).toBe(false);

    const applied = applyPlanSelections(
      emptyData(),
      result.data.subjects.map((subject) => ({
        subjectId: "",
        createName: subject.name,
        plan: subject.plan,
        standards: subject.standards,
        elements: subject.elements,
      })),
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const expected: Record<string, number> = { 국어: 16, 사회: 12, 도덕: 8, 수학: 18, 과학: 15, 체육: 17, 음악: 13, 미술: 5, 영어: 21 };
    for (const [name, count] of Object.entries(expected)) {
      const subject = applied.data.subjects.find((item) => item.name === name);
      expect(subject).toBeTruthy();
      if (!subject) continue;
      const topics = lessonTopics(subject);
      expect(topics).toHaveLength(count);
      for (const topic of topics) {
        expect(topic.elementId).not.toBe("");
        const element = subject.elements.find((item) => item.id === topic.elementId);
        expect(element?.name).toBeTruthy();
        expect(levelLabels(subject, topic)).toEqual(element?.levels.map((level) => level.label).filter(Boolean));
      }
    }
    const social = applied.data.subjects.find((subject) => subject.name === "사회");
    expect(lessonTopics(social!).map((topic) => topic.title).filter((title) => title.startsWith("1."))).toHaveLength(4);
  });

  it("문서 하단 문항수와 다르면 검토 경고를 남긴다", () => {
    const plan = interpretPlan(
      [
        {
          kind: "table",
          rows: [
            ["과목", "단원", "평가요소", "영역", "시기", "평가방법", "성취기준", "상", "중", "하"],
            ["도덕", "1. 통일", "까닭을 알고", "공동체", "", "서술", "[4도01-01] 통일을 설명한다.", "설명한다.", "말한다.", "어려워한다."],
          ],
        },
      ],
      { 도덕: 8 },
    );
    expect(plan.warnings.some((warning) => warning.includes("도덕") && warning.includes("8개"))).toBe(true);
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
