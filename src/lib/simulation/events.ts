import type { Catalog, PlanSelection } from "../../contracts/organizer.ts";
import { ACTION_CANCELLATION_EVENT, REQUIRED_ACTION_EVENT, SCHOOL_CANCELLATION_EVENT } from "../../data/team-events.ts";
import { DomainError, simulatePlan } from "./index.ts";
import { comparison, copyPlan, lexical, nonemptyString, rank, record, replacementPlan } from "./event-utils.ts";
import { confirmOpportunity, previewOpportunity } from "./opportunity.ts";
import type {
  OpportunityConfirmInput, OpportunityConfirmResult, OpportunityPreviewInput, OpportunityPreviewResult,
  TeamCancellationEvent, TeamEventConfirmInput, TeamEventConfirmResult, TeamEventPreviewInput,
  TeamEventPreviewResult, TeamReplacementOption,
} from "./event-types.ts";

export type * from "./event-types.ts";

function prepareEvent(input: TeamEventPreviewInput, catalog: Catalog) {
  if (!record(input) || !nonemptyString(input.eventId) || !nonemptyString(input.eventVersion)) {
    throw new DomainError("INVALID_EVENT_INPUT", "Необходимы исходный план, ID и версия события.");
  }
  const isSchoolEvent = input.eventId === SCHOOL_CANCELLATION_EVENT.id;
  const rule = isSchoolEvent ? SCHOOL_CANCELLATION_EVENT
    : input.eventId === ACTION_CANCELLATION_EVENT.id ? ACTION_CANCELLATION_EVENT : undefined;
  if (!rule) throw new DomainError("UNKNOWN_EVENT", "Неизвестное событие команды.");
  if (input.eventVersion !== rule.version) throw new DomainError("EVENT_VERSION_MISMATCH", "Версия сценария события не совпадает.");
  if ("requiredActionId" in input && input.requiredActionId !== undefined) {
    throw new DomainError("INVALID_EVENT_INPUT", "Отмена и обязательное мероприятие — разные сценарии.");
  }
  if (input.cancelledActionId !== undefined && !nonemptyString(input.cancelledActionId)) {
    throw new DomainError("INVALID_EVENT_INPUT", "ID отменяемой меры должен быть непустой строкой.");
  }
  const cancelledActionId = isSchoolEvent ? SCHOOL_CANCELLATION_EVENT.cancelledActionId : input.cancelledActionId;
  if (!nonemptyString(cancelledActionId)) throw new DomainError("INVALID_EVENT_INPUT", "Для отмены необходимо указать cancelledActionId.");
  if (isSchoolEvent && input.cancelledActionId !== undefined && input.cancelledActionId !== cancelledActionId) {
    throw new DomainError("INVALID_EVENT_INPUT", "Сценарий cancel-m7 отменяет только M7; для другой меры используйте cancel-action.");
  }
  const base = simulatePlan(input.basePlan, catalog);
  if (!base.valid) throw new DomainError("INVALID_BASE_PLAN", "Событие применимо только к допустимой исходной пятёрке.", base.errors);
  if (base.plan.modelVersion !== rule.modelVersion || base.plan.selections.length !== 5) {
    throw new DomainError("EVENT_MODEL_MISMATCH", "Сценарий предназначен для пятёрки решений organizer-v1.");
  }
  const removed = base.plan.selections.find((selection) => selection.actionId === cancelledActionId);
  if (!removed) throw new DomainError("EVENT_NOT_APPLICABLE", `В исходной пятёрке нет отменяемой меры ${cancelledActionId}.`);
  const action = catalog.actions.find((item) => item.id === removed.actionId)!;
  const event: TeamCancellationEvent = isSchoolEvent
    ? { ...SCHOOL_CANCELLATION_EVENT, replacementActionIds: [...SCHOOL_CANCELLATION_EVENT.replacementActionIds] }
    : {
      ...rule,
      title: `Отмена мероприятия ${action.id}: ${action.title}`,
      cancelledActionId,
      replacementActionIds: catalog.actions.filter((item) => item.id !== cancelledActionId).map((item) => item.id).sort(lexical),
    };
  const draft = copyPlan(base.plan);
  draft.selections = draft.selections.filter((selection) => selection.actionId !== removed.actionId);
  const draftResult = simulatePlan(draft, catalog);
  if (draftResult.valid) throw new DomainError("INVALID_EVENT_STATE", "Черновик после отмены не должен иметь официальный результат.");
  const refundAmount = action.cost;
  return { base, event, draft, draftResult, refundAmount, availableBudget: draftResult.remainingBudget };
}

/** Enumerate every allowed action/target, scoring only complete five-action plans. */
function previewCancellation(input: TeamEventPreviewInput, catalog: Catalog): TeamEventPreviewResult {
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
function confirmCancellation(input: TeamEventConfirmInput, catalog: Catalog): TeamEventConfirmResult {
  if (!record(input) || !nonemptyString(input.removedActionId) || !nonemptyString(input.addedActionId)
    || (input.addedDistrictId !== undefined && typeof input.addedDistrictId !== "string")) {
    throw new DomainError("INVALID_REPLACEMENT_INPUT", "Необходимы ID удаляемой меры, ID замены и корректный район.");
  }
  const state = prepareEvent(input, catalog);
  if (input.removedActionId !== state.event.cancelledActionId) {
    throw new DomainError("INVALID_REMOVAL", `При отмене ${state.event.cancelledActionId} нельзя удалить другую меру.`);
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

export function previewEvent(input: OpportunityPreviewInput, catalog: Catalog): OpportunityPreviewResult;
export function previewEvent(input: TeamEventPreviewInput, catalog: Catalog): TeamEventPreviewResult;
export function previewEvent(input: TeamEventPreviewInput | OpportunityPreviewInput, catalog: Catalog): TeamEventPreviewResult | OpportunityPreviewResult {
  if (input?.eventId === REQUIRED_ACTION_EVENT.id) return previewOpportunity(input as OpportunityPreviewInput, catalog);
  return previewCancellation(input, catalog);
}

export function confirmEvent(input: OpportunityConfirmInput, catalog: Catalog): OpportunityConfirmResult;
export function confirmEvent(input: TeamEventConfirmInput, catalog: Catalog): TeamEventConfirmResult;
export function confirmEvent(input: TeamEventConfirmInput | OpportunityConfirmInput, catalog: Catalog): TeamEventConfirmResult | OpportunityConfirmResult {
  if (input?.eventId === REQUIRED_ACTION_EVENT.id) return confirmOpportunity(input as OpportunityConfirmInput, catalog);
  return confirmCancellation(input, catalog);
}
