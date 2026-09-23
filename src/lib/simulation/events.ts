import { INDICATORS } from "../../contracts/index.ts";
import type { Catalog, Comparison, Metrics, PlanInput, PlanSelection, ValidSimulation } from "../../contracts/index.ts";
import { SCHOOL_CANCELLATION_EVENT } from "../../data/team-events.ts";
import { DomainError, simulatePlan } from "./index.ts";
import type {
  TeamEventConfirmInput, TeamEventConfirmResult, TeamEventPreviewInput,
  TeamEventPreviewResult, TeamReplacementOption,
} from "./event-types.ts";

export type * from "./event-types.ts";

const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const nonemptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const copyPlan = (plan: PlanInput): PlanInput => ({ modelVersion: plan.modelVersion, selections: plan.selections.map((selection) => ({ ...selection })) });
const eventSnapshot = () => ({ ...SCHOOL_CANCELLATION_EVENT, replacementActionIds: [...SCHOOL_CANCELLATION_EVENT.replacementActionIds] });

function prepareEvent(input: TeamEventPreviewInput, catalog: Catalog) {
  if (!record(input) || !nonemptyString(input.eventId) || !nonemptyString(input.eventVersion)) {
    throw new DomainError("INVALID_EVENT_INPUT", "Необходимы исходный план, ID и версия события.");
  }
  const event = eventSnapshot();
  if (input.eventId !== event.id) throw new DomainError("UNKNOWN_EVENT", "Неизвестное событие команды.");
  if (input.eventVersion !== event.version) throw new DomainError("EVENT_VERSION_MISMATCH", "Версия сценария события не совпадает.");
  const base = simulatePlan(input.basePlan, catalog);
  if (!base.valid) throw new DomainError("INVALID_BASE_PLAN", "Событие применимо только к допустимой исходной пятёрке.", base.errors);
  if (base.plan.modelVersion !== event.modelVersion || base.plan.selections.length !== 5) {
    throw new DomainError("EVENT_MODEL_MISMATCH", "Сценарий предназначен для пятёрки решений organizer-v1.");
  }
  const removed = base.plan.selections.find((selection) => selection.actionId === event.cancelledActionId);
  if (!removed) throw new DomainError("EVENT_NOT_APPLICABLE", "В исходной пятёрке нет отменяемой меры M7.");
  const draft = copyPlan(base.plan);
  draft.selections = draft.selections.filter((selection) => selection.actionId !== removed.actionId);
  const draftResult = simulatePlan(draft, catalog);
  if (draftResult.valid) throw new DomainError("INVALID_EVENT_STATE", "Черновик после отмены не должен иметь официальный результат.");
  const refundAmount = catalog.actions.find((action) => action.id === removed.actionId)!.cost;
  return { base, event, draft, draftResult, refundAmount, availableBudget: draftResult.remainingBudget };
}

function comparison(base: ValidSimulation, branch: ValidSimulation): Comparison {
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

function replacementPlan(draft: PlanInput, addedSelection: PlanSelection): PlanInput {
  const plan = copyPlan(draft);
  plan.selections.push({ ...addedSelection });
  return plan;
}

/** Prefer higher Score, then lower cost, then stable action/district ID ordering. */
function rank(a: TeamReplacementOption, b: TeamReplacementOption): number {
  return b.result.officialScore - a.result.officialScore
    || a.result.totalCost - b.result.totalCost
    || lexical(a.addedActionId, b.addedActionId)
    || lexical(a.addedSelection.districtId ?? "", b.addedSelection.districtId ?? "");
}

/** Enumerate every allowed action/target, scoring only complete five-action plans. */
export function previewEvent(input: TeamEventPreviewInput, catalog: Catalog): TeamEventPreviewResult {
  const state = prepareEvent(input, catalog);
  const retainedIds = new Set(state.draft.selections.map((selection) => selection.actionId));
  const bestByAction = new Map<string, TeamReplacementOption>();
  for (const action of catalog.actions) {
    if (retainedIds.has(action.id) || !state.event.replacementActionIds.includes(action.id)) continue;
    const selections: PlanSelection[] = action.scope === "city"
      ? [{ actionId: action.id }]
      : catalog.districts.map((district) => ({ actionId: action.id, districtId: district.id }));
    for (const addedSelection of selections) {
      const result = simulatePlan(replacementPlan(state.draft, addedSelection), catalog);
      if (!result.valid) continue;
      const option: TeamReplacementOption = {
        removedActionId: state.event.cancelledActionId,
        addedActionId: action.id,
        addedSelection: { ...addedSelection },
        plan: copyPlan(result.plan),
        result,
        comparison: comparison(state.base, result),
      };
      const previous = bestByAction.get(action.id);
      if (!previous || rank(option, previous) < 0) bestByAction.set(action.id, option);
    }
  }
  return {
    ...state,
    requiresReplacement: true,
    replacementOptions: [...bestByAction.values()].sort(rank).slice(0, state.event.maxRecommendations),
  };
}

/** Rebuild from the authoritative base plan and current catalog; never trust a preview. */
export function confirmEvent(input: TeamEventConfirmInput, catalog: Catalog): TeamEventConfirmResult {
  if (!record(input) || !nonemptyString(input.removedActionId) || !nonemptyString(input.addedActionId)
    || (input.addedDistrictId !== undefined && typeof input.addedDistrictId !== "string")) {
    throw new DomainError("INVALID_REPLACEMENT_INPUT", "Необходимы ID удаляемой меры, ID замены и корректный район.");
  }
  const state = prepareEvent(input, catalog);
  if (input.removedActionId !== state.event.cancelledActionId) {
    throw new DomainError("INVALID_REMOVAL", "При отмене M7 нельзя удалить другую меру.");
  }
  if (!state.event.replacementActionIds.includes(input.addedActionId)) {
    const code = input.addedActionId === state.event.cancelledActionId ? "ACTION_UNAVAILABLE"
      : catalog.actions.some((action) => action.id === input.addedActionId) ? "REPLACEMENT_NOT_ALLOWED" : "UNKNOWN_ACTION";
    const issue = { code, message: "Эта мера недоступна как замена в данном сценарии.", actionIds: [input.addedActionId] };
    throw new DomainError("INVALID_REPLACEMENT", issue.message, [issue]);
  }
  const addedSelection: PlanSelection = input.addedDistrictId === undefined
    ? { actionId: input.addedActionId }
    : { actionId: input.addedActionId, districtId: input.addedDistrictId };
  const branch = simulatePlan(replacementPlan(state.draft, addedSelection), catalog);
  if (!branch.valid) throw new DomainError("INVALID_REPLACEMENT", "Замена не образует допустимую пятёрку.", branch.errors);
  return { base: state.base, event: state.event, branch, comparison: comparison(state.base, branch) };
}
