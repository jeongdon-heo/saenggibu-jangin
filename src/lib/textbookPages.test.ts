import { describe, expect, it } from "vitest";
import grade4Progress from "./fixtures/grade4-term2-progress.json";
import { storeProgressLessons } from "./curriculum";
import { emptyData } from "./defaults";
import { addSubject } from "./model";
import { parseProgressTable } from "./progressSheet";
import { lessonTopics } from "./teacherAssess";
import { pageHint } from "./textbookPages";
import { readXlsxTable } from "./xlsxRead";

function bytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
  return data;
}

describe("진도표 쪽수", () => {
  it("사회 단원 범위와 추천 차시 쪽수를 계산하고 평가 열은 지우지 않는다", () => {
    const table = readXlsxTable(bytes(grade4Progress.base64));
    expect(table.ok).toBe(true);
    if (!table.ok) return;
    const parsed = parseProgressTable(table.data);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.length).toBeGreaterThan(500);
    const created = addSubject(emptyData(), "사회");
    expect(created.ok).toBe(true);
    if (!created.ok || !created.id) return;
    const subjectId = created.id;
    const seeded = {
      ...created.data,
      subjects: created.data.subjects.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              units: [
                { id: "keep", order: 1, grade: 4, semester: 2 as const, organization: "", title: "1. 민주주의와 자치", content: "", pages: "", extraPages: "", period: "", totalPeriods: "", materials: "", skipped: false, elementId: "e1", chosenPages: "" },
              ],
              elements: [
                { id: "e1", name: "주민 자치의 의미와 필요성 알아보기", unitId: "keep", standardCodes: [], levels: [], note: "" },
                { id: "e2", name: "자연환경과 인문환경의 의미를 알고 구분하기", unitId: "", standardCodes: [], levels: [], note: "" },
                { id: "e3", name: "우리나라 도시의 인구, 교통, 산업등의 특징 조사하기", unitId: "", standardCodes: [], levels: [], note: "" },
              ],
            }
          : subject,
      ),
    };
    seeded.subjects[0]!.units.push(
      { id: "u2", order: 2, grade: 4, semester: 2, organization: "", title: "2. 지역문제를 해결하고 지역을 알리는 노력", content: "", pages: "", extraPages: "", period: "", totalPeriods: "", materials: "", skipped: false, elementId: "e4", chosenPages: "" },
      { id: "u3", order: 3, grade: 4, semester: 2, organization: "", title: "3. 다양한 환경과 삶의 모습", content: "", pages: "", extraPages: "", period: "", totalPeriods: "", materials: "", skipped: false, elementId: "e2", chosenPages: "" },
      { id: "u4", order: 4, grade: 4, semester: 2, organization: "", title: "3. 다양한 환경과 삶의 모습", content: "", pages: "", extraPages: "", period: "", totalPeriods: "", materials: "", skipped: false, elementId: "e3", chosenPages: "" },
    );
    seeded.subjects[0]!.elements.push({ id: "e4", name: "우리 지역의 문제를 조사하고 해결하기", unitId: "u2", standardCodes: [], levels: [], note: "" });
    const stored = storeProgressLessons(seeded, parsed.data);
    const subject = stored.data.subjects[0]!;
    expect(subject.units.map((unit) => unit.id)).toEqual(["keep", "u2", "u3", "u4"]);
    expect(subject.lessons?.some((lesson) => lesson.title.includes("자율"))).toBe(false);
    const topics = lessonTopics(subject);
    const hint = (name: string) => pageHint(subject, topics.find((topic) => subject.elements.find((item) => item.id === topic.elementId)?.name === name)!);
    expect(hint("주민 자치의 의미와 필요성 알아보기")).toMatchObject({ unitPages: "12~51", recommendedPages: "34~35" });
    expect(hint("우리 지역의 문제를 조사하고 해결하기")).toMatchObject({ unitPages: "56~95", recommendedPages: "67~69" });
    expect(hint("자연환경과 인문환경의 의미를 알고 구분하기")?.unitPages).toBe("100~137");
    expect(hint("우리나라 도시의 인구, 교통, 산업등의 특징 조사하기")?.recommendedPages).toBe("118~120");
  });
});
