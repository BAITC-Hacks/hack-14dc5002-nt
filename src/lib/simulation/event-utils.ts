import { INDICATORS } from "../../contracts/organizer.ts";
import type { Comparison, Metrics, PlanInput, PlanSelection, ValidSimulation } from "../../contracts/organizer.ts";
import type { TeamReplacementOption } from "./event-types.ts";

export const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
export const nonemptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
export const copyPlan = (plan: PlanInput): PlanInput => ({ modelVersion: plan.modelVersion, selections: plan.selections.map((selection) => ({ ...selection })) });

export function comparison(base: ValidSimulation, branch: ValidSimulation): Comparison {
  const delta = (before: Metrics, after: Metrics): Metrics => Object.fromEntries(
    INDICATORS.map((indicator) => [indicator, after[indicator] - before[indicator]]),
  ) as Metrics;
  const beforeById = new Map(base.metrics.districts.map((district) => [district.districtId, district]));
  return {
    scoreDelta: branch.officialScore - base.officialScore,
    indicatorsDelta: delta(base.metrics.indicators, branch.metrics.indicators),
    districts: branch.metrics.districts.map((district) => ({
      districtId: district.districtId,
      scoreDelta: district.scoreAfter - beforeById.get(district.districtId)!.scoreAfter,
      indicatorsDelta: delta(beforeById.get(district.districtId)!.after, district.after),
    })),
  };
}

export function replacementPlan(draft: PlanInput, addedSelection: PlanSelection): PlanInput {
  const plan = copyPlan(draft);
  plan.selections.push({ ...addedSelection });
  return plan;
}

/** Higher Score, lower total cost, then stable removed/added action and district IDs. */
export function rank(a: TeamReplacementOption, b: TeamReplacementOption): number {
  return b.result.officialScore - a.result.officialScore
    || a.result.totalCost - b.result.totalCost
    || lexical(a.removedActionId, b.removedActionId)
    || lexical(a.addedActionId, b.addedActionId)
    || lexical(a.addedSelection.districtId ?? "", b.addedSelection.districtId ?? "");
}
