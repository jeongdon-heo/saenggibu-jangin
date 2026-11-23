import type { ProgressLesson, Subject, Unit } from "../types";

export type LessonChoice = {
  period: string;
  content: string;
  pages: string;
  extraPages: string;
};

export type PageHint = {
  unitPages: string;
  extraPages: string;
  recommendedPages: string;
  recommendedContent: string;
  chosen: boolean;
  shownPages: string;
  choices: LessonChoice[];
};

function hangul(text: string): string {
  return text.replace(/[^가-힣]/g, "");
}

function focusText(text: string): string {
  const folded = hangul(text).replace(/우리|지역|생각|활동|특징|조사|의미|중요|방법|알아|살펴|하기/g, "");
  return folded.length >= 2 ? folded : hangul(text);
}

function overlapScore(element: string, lesson: string, siblings: string[], minimum: number): number {
  const a = focusText(element);
  const b = focusText(lesson);
  const folded = siblings.map(focusText);
  const used = new Array<boolean>(b.length).fill(false);
  let score = 0;
  for (let length = Math.min(a.length, 12); length >= minimum; length -= 1) {
    for (let index = 0; index + length <= a.length; index += 1) {
      const slice = a.slice(index, index + length);
      const at = b.indexOf(slice);
      if (at < 0) continue;
      if (used.slice(at, at + length).some(Boolean)) continue;
      for (let cursor = 0; cursor < length; cursor += 1) used[at + cursor] = true;
      const hits = Math.max(1, folded.filter((text) => text.includes(slice)).length);
      const weight = length >= 3 ? length * length : length;
      score += weight * Math.min(3, folded.length / hits);
    }
  }
  return score;
}

export function contentScore(element: string, lesson: string, siblings: string[] = [lesson]): number {
  return overlapScore(element, lesson, siblings, 2);
}

export function textOverlap(left: string, right: string): number {
  const a = hangul(left);
  const b = hangul(right);
  if (a.length < 2 || b.length < 2) return 0;
  const bag = new Map<string, number>();
  for (let index = 0; index < a.length - 1; index += 1) {
    const gram = a.slice(index, index + 2);
    bag.set(gram, (bag.get(gram) ?? 0) + 1);
  }
  let hits = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const gram = b.slice(index, index + 2);
    const count = bag.get(gram) ?? 0;
    if (count > 0) {
      hits += 1;
      bag.set(gram, count - 1);
    }
  }
  return (2 * hits) / (a.length - 1 + (b.length - 1));
}

export function unitNumberKey(title: string): string {
  const numbered = title.trim().match(/^(\d+(?:-\d+)?)\s*\./);
  if (numbered?.[1]) return numbered[1];
  const bracket = title.match(/<\s*([^>]+)\s*>/);
  if (bracket?.[1]) return `<${bracket[1].replace(/\s+/g, "")}>`;
  return "";
}

function pageNumbers(value: string): number[] {
  return [...value.matchAll(/\d+/g)].map((match) => Number(match[0])).filter((number) => Number.isInteger(number));
}

export function formatPageSpan(values: string[]): string {
  const numbers = values.flatMap(pageNumbers);
  if (numbers.length === 0) return "";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return min === max ? String(min) : `${min}~${max}`;
}

export function lessonContentKey(content: string): string {
  return content.replace(/\s*-\d+-\s*$/g, "").replace(/\s+/g, "");
}

export function isCreativeSubject(name: string): boolean {
  return /자율|동아리|진로|창의적체험/.test(name.replace(/\s+/g, ""));
}

function sameTitle(left: string, right: string): boolean {
  return left.replace(/\s+/g, "") === right.replace(/\s+/g, "");
}

export function lessonsForTopic(subject: Subject, topic: Unit): ProgressLesson[] {
  const lessons = subject.lessons ?? [];
  const titles = [...new Set(lessons.map((lesson) => lesson.title))];
  const key = unitNumberKey(topic.title);
  const pool = key ? titles.filter((title) => unitNumberKey(title) === key) : titles;
  if (pool.length === 0) return [];
  let best = pool[0] ?? "";
  let bestScore = -1;
  for (const title of pool) {
    const score = textOverlap(topic.title, title);
    if (score > bestScore) {
      bestScore = score;
      best = title;
    }
  }
  return lessons.filter((lesson) => sameTitle(lesson.title, best));
}

function withDisplayPeriod(lessons: ProgressLesson[]): Array<ProgressLesson & { displayPeriod: string }> {
  let index = 0;
  let previousKey = "";
  let previousPeriod = "";
  return lessons.map((lesson) => {
    const key = lessonContentKey(lesson.content);
    if (lesson.period.trim()) {
      previousPeriod = lesson.period.trim();
      if (key !== previousKey) index = Number(previousPeriod) || index + 1;
    } else if (key !== previousKey) {
      index += 1;
      previousPeriod = String(index);
    }
    previousKey = key;
    return { ...lesson, displayPeriod: previousPeriod };
  });
}

export function lessonChoices(lessons: ProgressLesson[]): LessonChoice[] {
  const choices: LessonChoice[] = [];
  for (const lesson of withDisplayPeriod(lessons)) {
    const key = lessonContentKey(lesson.content);
    const previous = choices[choices.length - 1];
    if (previous && lessonContentKey(previous.content) === key) {
      previous.pages = formatPageSpan([previous.pages, lesson.pages]);
      previous.extraPages = formatPageSpan([previous.extraPages, lesson.extraPages]);
      continue;
    }
    choices.push({
      period: lesson.displayPeriod,
      content: lesson.content.replace(/\s*-\d+-\s*$/g, "").trim(),
      pages: formatPageSpan([lesson.pages]),
      extraPages: formatPageSpan([lesson.extraPages]),
    });
  }
  return choices;
}

export function pageHint(subject: Subject, topic: Unit): PageHint | null {
  const lessons = lessonsForTopic(subject, topic);
  if (lessons.length === 0) return null;
  const choices = lessonChoices(lessons);
  const element = subject.elements.find((item) => item.id === topic.elementId);
  let recommended = choices[0];
  let best = -1;
  const siblings = choices.map((choice) => choice.content);
  for (const choice of choices) {
    const score = contentScore(element?.name ?? topic.title, choice.content, siblings);
    if (score > best) {
      best = score;
      recommended = choice;
    }
  }
  const chosenPages = topic.chosenPages?.trim() ?? "";
  const recommendedPages = recommended?.pages ?? "";
  return {
    unitPages: formatPageSpan(lessons.map((lesson) => lesson.pages)),
    extraPages: formatPageSpan(lessons.map((lesson) => lesson.extraPages)),
    recommendedPages,
    recommendedContent: recommended?.content ?? "",
    chosen: chosenPages.length > 0,
    shownPages: chosenPages || recommendedPages,
    choices,
  };
}
