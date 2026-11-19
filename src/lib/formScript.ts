import type { ClassInfo, Question } from "../types";
import { questionTypeLabel } from "./questionTypes";

export type FormPreviewItem = {
  questionId: string;
  typeLabel: string;
  prompt: string;
  choices: string[];
  studentControl: string;
};

export type FormPreview = {
  title: string;
  description: string;
  numberHelp: string;
  items: FormPreviewItem[];
};

function classBit(info: ClassInfo): string {
  const grade = info.grade ? `${info.grade}학년` : "";
  const label = info.classLabel.trim();
  const room = label ? (/^\d+$/.test(label) ? `${label}반` : label) : "";
  return [info.schoolYear ? `${info.schoolYear}학년도` : "", `${info.semester}학기`, grade, room].filter(Boolean).join(" ");
}

export function selectedQuestions(questions: Question[], subjectId?: string): Question[] {
  return questions
    .filter((question) => question.approved && question.selected && (subjectId ? question.subjectId === subjectId : true))
    .sort((a, b) => a.order - b.order);
}

export function buildFormPreview(info: ClassInfo, subjectName: string, questions: Question[]): FormPreview {
  const chosen = selectedQuestions(questions);
  return {
    title: `${classBit(info)} ${subjectName} 성취수준 확인`.replace(/\s+/g, " ").trim(),
    description: "이름은 적지 않습니다. 출석 번호만 숫자로 적어 주세요.",
    numberHelp: "이름은 적지 마세요. 출석 번호만 숫자로 적으세요.",
    items: chosen.map((question) => ({
      questionId: question.id,
      typeLabel: questionTypeLabel(question.type),
      prompt: question.prompt,
      choices: question.choices.map((choice) => choice.trim()).filter(Boolean),
      studentControl:
        question.type === "choice"
          ? "하나만 고름"
          : question.type === "check"
            ? "여러 개 고를 수 있음"
            : question.type === "essay"
              ? "긴 답"
              : "짧은 답",
    })),
  };
}

export function jsString(value: string): string {
  return `'${value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")}'`;
}

function choiceList(choices: string[]): string {
  return `[${choices.map(jsString).join(", ")}]`;
}

export function buildFormScript(preview: FormPreview): string {
  const lines = [
    "function createSaenggiForm() {",
    `  var form = FormApp.create(${jsString(preview.title)});`,
    `  form.setDescription(${jsString(preview.description)});`,
    "  form.setIsQuiz(false);",
    "  form.setCollectEmail(false);",
    "  var numberItem = form.addTextItem();",
    "  numberItem.setTitle('번호');",
    `  numberItem.setHelpText(${jsString(preview.numberHelp)});`,
    "  numberItem.setRequired(true);",
    "  numberItem.setValidation(FormApp.createTextValidation().requireNumber().build());",
  ];
  for (const item of preview.items) {
    lines.push(`  var item = null;`);
    if (item.studentControl === "하나만 고름" && item.choices.length > 0) {
      lines.push("  item = form.addMultipleChoiceItem();");
      lines.push(`  item.setTitle(${jsString(item.prompt)});`);
      lines.push(`  item.setChoiceValues(${choiceList(item.choices)});`);
      lines.push("  item.setRequired(true);");
    } else if (item.studentControl === "여러 개 고를 수 있음" && item.choices.length > 0) {
      lines.push("  item = form.addCheckboxItem();");
      lines.push(`  item.setTitle(${jsString(item.prompt)});`);
      lines.push(`  item.setChoiceValues(${choiceList(item.choices)});`);
      lines.push("  item.setRequired(false);");
    } else if (item.studentControl === "긴 답" || item.choices.length === 0 && item.studentControl === "하나만 고름") {
      lines.push("  item = form.addParagraphTextItem();");
      lines.push(`  item.setTitle(${jsString(item.prompt)});`);
      lines.push("  item.setRequired(true);");
    } else if (item.studentControl === "짧은 답") {
      lines.push("  item = form.addTextItem();");
      lines.push(`  item.setTitle(${jsString(item.prompt)});`);
      lines.push("  item.setRequired(true);");
    } else {
      lines.push("  item = form.addParagraphTextItem();");
      lines.push(`  item.setTitle(${jsString(item.prompt)});`);
      lines.push("  item.setRequired(true);");
    }
  }
  lines.push("  Logger.log('학생 링크: ' + form.getPublishedUrl());");
  lines.push("  Logger.log('편집 링크: ' + form.getEditUrl());");
  lines.push("}");
  return lines.join("\n");
}

export function studentFormText(preview: FormPreview): string {
  const lines = [preview.title, preview.description, "", "번호 (필수)", ""];
  preview.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.prompt}`);
    item.choices.forEach((choice, choiceIndex) => {
      lines.push(`   ${choiceIndex + 1}) ${choice}`);
    });
    lines.push("");
  });
  return lines.join("\n").trim();
}
