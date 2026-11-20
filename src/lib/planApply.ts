import { mergeElements } from "./curriculum";
import type { ParsedElement } from "./elementsParse";
import { addSubject, mergePlanItems, mergeStandards } from "./model";
import type { ParsedPlanItem, ParsedStandard } from "./parse";
import type { AppData, Result } from "../types";

export type PlanSelection = {
  subjectId: string;
  createName: string;
  plan: ParsedPlanItem[];
  standards: ParsedStandard[];
  elements: ParsedElement[];
};

export type PlanApplyCounts = {
  addedPlan: number;
  updatedPlan: number;
  skippedPlan: number;
  addedStandards: number;
  updatedStandards: number;
  addedElements: number;
  updatedElements: number;
  skippedElements: number;
};

const EMPTY_COUNTS: PlanApplyCounts = {
  addedPlan: 0,
  updatedPlan: 0,
  skippedPlan: 0,
  addedStandards: 0,
  updatedStandards: 0,
  addedElements: 0,
  updatedElements: 0,
  skippedElements: 0,
};

export function applyPlanSelections(data: AppData, selections: PlanSelection[]): Result<AppData> & PlanApplyCounts {
  const counts = { ...EMPTY_COUNTS };
  let next = data;
  let used = false;
  for (const selection of selections) {
    if (selection.plan.length === 0 && selection.standards.length === 0 && selection.elements.length === 0) continue;
    let subjectId = selection.subjectId;
    if (!subjectId && selection.createName.trim()) {
      const existing = next.subjects.find((subject) => subject.name === selection.createName.trim());
      if (existing) subjectId = existing.id;
      else {
        const created = addSubject(next, selection.createName);
        if (!created.ok || !created.id) {
          return { ok: false, error: created.ok ? "과목을 만들지 못했습니다." : created.error, ...counts };
        }
        next = created.data;
        subjectId = created.id;
      }
    }
    if (!subjectId) continue;
    used = true;
    if (selection.plan.length > 0) {
      const merged = mergePlanItems(next, subjectId, selection.plan);
      if (!merged.ok) return { ok: false, error: merged.error, ...counts };
      next = merged.data;
      counts.addedPlan += merged.added;
      counts.updatedPlan += merged.updated;
      counts.skippedPlan += merged.skipped;
    }
    if (selection.standards.length > 0) {
      const merged = mergeStandards(next, subjectId, selection.standards);
      if (!merged.ok) return { ok: false, error: merged.error, ...counts };
      next = merged.data;
      counts.addedStandards += merged.added;
      counts.updatedStandards += merged.updated;
    }
    if (selection.elements.length > 0) {
      const merged = mergeElements(next, subjectId, selection.elements);
      if (!merged.ok) return { ok: false, error: merged.error, ...counts };
      next = merged.data;
      counts.addedElements += merged.added;
      counts.updatedElements += merged.updated;
      counts.skippedElements += merged.skipped;
    }
  }
  if (!used) return { ok: false, error: "넣을 항목이 없습니다. 과목을 고르고, 남길 항목을 체크해 주세요.", ...counts };
  return { ok: true, data: next, ...counts };
}

export function planApplyMessage(counts: PlanApplyCounts): string {
  const added = [
    counts.addedPlan > 0 ? `평가 항목 ${counts.addedPlan}개` : "",
    counts.addedStandards > 0 ? `성취기준 ${counts.addedStandards}개` : "",
    counts.addedElements > 0 ? `평가요소 ${counts.addedElements}개` : "",
  ].filter(Boolean);
  const kept = counts.skippedPlan + counts.updatedStandards + counts.skippedElements + counts.updatedPlan + counts.updatedElements;
  if (added.length === 0 && kept === 0) return "선택한 내용이 이미 있어 새로 넣지 않았습니다.";
  const lead = added.length > 0 ? `${added.join(", ")}를 넣었습니다.` : "새로 넣은 항목은 없습니다.";
  return kept > 0 ? `${lead} 이미 있던 성취기준·평가요소·평가 항목은 겹치면 다시 만들지 않았습니다.` : lead;
}
