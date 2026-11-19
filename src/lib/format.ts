import type { ClassInfo } from "../types";

export function isClassReady(info: ClassInfo): boolean {
  return info.grade !== null && info.classLabel.trim().length > 0;
}

export function classNameText(info: ClassInfo): string {
  const label = info.classLabel.trim();
  if (!label) return "";
  return /^\d+$/.test(label) ? `${label}반` : label;
}

export function classSummary(info: ClassInfo): string | null {
  if (!isClassReady(info) || info.grade === null) return null;
  return `${info.schoolYear}학년도 ${info.semester}학기 · ${info.grade}학년 ${classNameText(info)}`;
}

export function subjectSuggestions(grade: number | null): string[] {
  if (grade === 1 || grade === 2) return ["국어", "수학", "바른 생활", "슬기로운 생활", "즐거운 생활"];
  if (grade === 3 || grade === 4) return ["국어", "수학", "사회", "과학", "도덕", "영어", "음악", "미술", "체육"];
  if (grade === 5 || grade === 6) {
    return ["국어", "수학", "사회", "과학", "도덕", "영어", "음악", "미술", "체육", "실과"];
  }
  return ["국어", "수학", "사회", "과학", "도덕", "영어", "음악", "미술", "체육", "실과"];
}

function fileToken(info: ClassInfo): string {
  const summary = classSummary(info);
  if (!summary) return "학급미설정";
  return summary.replace(/[\\/:*?"<>|\s·]+/g, "_").replace(/_+/g, "_");
}

function dateStamp(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function backupFilename(info: ClassInfo, date = new Date()): string {
  return `생기부장인_백업_${fileToken(info)}_${dateStamp(date)}.json`;
}

export function xlsxFilename(info: ClassInfo): string {
  return `생기부장인_교과학습발달상황_${fileToken(info)}.xlsx`;
}

export function savedLabel(iso: string | null): string {
  if (!iso) return "이 브라우저에 저장됩니다";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "이 브라우저에 저장됩니다";
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const ampm = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 || 12;
  return `${ampm} ${hour12}:${minute}에 이 브라우저에 저장됨`;
}
