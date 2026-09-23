import type { Catalog, PlanSelection } from "../../contracts/index.ts";
import { REQUIRED_ACTION_EVENT } from "../../data/team-events.ts";
import { DomainError, simulatePlan } from "./index.ts";
import { comparison, copyPlan, nonemptyString, rank, record, replacementPlan } from "./event-utils.ts";
import type {
  OpportunityConfirmInput, OpportunityConfirmResult, OpportunityPreviewInput,
  OpportunityPreviewResult, OpportunityReplacementOption, TeamOpportunityEvent,
} from "./event-types.ts";

function prepareOpportunity(input: OpportunityPreviewInput, catalog: Catalog) {
  if (!record(input) || !nonemptyString(input.eventId) || !nonemptyString(input.eventVersion)
    || !nonemptyString(input.requiredActionId)) {
    throw new DomainError("INVALID_EVENT_INPUT", "Необходимы исходный план, ID/версия события и requiredActionId.");
  }
  if (input.eventId !== REQUIRED_ACTION_EVENT.id) throw new DomainError("UNKNOWN_EVENT", "Неизвестное событие обязательной меры.");
  if (input.eventVersion !== REQUIRED_ACTION_EVENT.version) throw new DomainError("EVENT_VERSION_MISMATCH", "Версия сценария события не совпадает.");
  if ("cancelledActionId" in input && input.cancelledActionId !== undefined) {
    throw new DomainError("INVALID_EVENT_INPUT", "Обязательное мероприятие и отмена — разные сценарии.");
  }
  const base = simulatePlan(input.basePlan, catalog);
  if (!base.valid) throw new DomainError("INVALID_BASE_PLAN", "Событие применимо только к допустимой исходной пятёрке.", base.errors);
  if (base.plan.selections.length !== 5) throw new DomainError("EVENT_MODEL_MISMATCH", "Для события нужна исходная пятёрка решений.");
  const action = catalog.actions.find((item) => item.id === input.requiredActionId);
  if (!action) throw new DomainError("UNKNOWN_ACTION", "Обязательная мера отсутствует в каталоге.", [
    { code: "UNKNOWN_ACTION", message: "Добавьте полное описание мероприятия в каталог до расчёта.", actionIds: [input.requiredActionId] },
  ]);
  const event: TeamOpportunityEvent = {
    ...REQUIRED_ACTION_EVENT,
    modelVersion: base.plan.modelVersion,
    requiredActionId: action.id,
    title: `Обязательное мероприятие ${action.id}: ${action.title}`,
  };
  const alreadySatisfied = base.plan.selections.some((selection) => selection.actionId === action.id);
  return { base, event, action, alreadySatisfied };
}

/** Try each removal and each valid target of the mandatory action; never append a sixth. */
export function previewOpportunity(input: OpportunityPreviewInput, catalog: Catalog): OpportunityPreviewResult {
  const { base, event, action, alreadySatisfied } = prepareOpportunity(input, catalog);
  if (alreadySatisfied) return { base, event, status: "already-satisfied", requiresReplacement: false, replacementOptions: [] };
  const targets: PlanSelection[] = action.scope === "city" ? [{ actionId: action.id }]
    : catalog.districts.map((district) => ({ actionId: action.id, districtId: district.id }));
  const bestByRemoval: OpportunityReplacementOption[] = [];
  for (const removed of base.plan.selections) {
    const draft = copyPlan(base.plan);
    draft.selections = draft.selections.filter((selection) => selection.actionId !== removed.actionId);
    let best: OpportunityReplacementOption | undefined;
    for (const addedSelection of targets) {
      const result = simulatePlan(replacementPlan(draft, addedSelection), catalog);
      if (!result.valid) continue;
      const refundAmount = catalog.actions.find((item) => item.id === removed.actionId)!.cost;
      const option: OpportunityReplacementOption = {
        removedActionId: removed.actionId, addedActionId: action.id, addedSelection: { ...addedSelection },
        refundAmount, availableBudget: base.remainingBudget + refundAmount,
        plan: copyPlan(result.plan), result, comparison: comparison(base, result),
      };
      if (!best || rank(option, best) < 0) best = option;
    }
    if (best) bestByRemoval.push(best);
  }
  const replacementOptions = bestByRemoval.sort(rank).slice(0, event.maxRecommendations);
  if (replacementOptions.length === 0) return { base, event, status: "no-valid-replacement", requiresReplacement: true, replacementOptions: [] };
  return { base, event, status: "replacement-required", requiresReplacement: true, replacementOptions };
}

/** Revalidate both the mandatory ID and the chosen removal using the current catalog. */
export function confirmOpportunity(input: OpportunityConfirmInput, catalog: Catalog): OpportunityConfirmResult {
  if (!record(input) || !nonemptyString(input.removedActionId) || !nonemptyString(input.addedActionId)
    || (input.addedDistrictId !== undefined && typeof input.addedDistrictId !== "string")) {
    throw new DomainError("INVALID_REPLACEMENT_INPUT", "Необходимы ID удаляемой меры, ID замены и корректный район.");
  }
  const { base, event, alreadySatisfied } = prepareOpportunity(input, catalog);
  if (alreadySatisfied) throw new DomainError("EVENT_ALREADY_SATISFIED", "Обязательная мера уже выбрана; замена не нужна.");
  if (input.addedActionId !== event.requiredActionId) throw new DomainError("REQUIRED_ACTION_MISMATCH", "Замена должна включать именно обязательное мероприятие.");
  if (!base.plan.selections.some((selection) => selection.actionId === input.removedActionId)) {
    throw new DomainError("INVALID_REMOVAL", "Удаляемая мера должна входить в исходную пятёрку.");
  }
  const draft = copyPlan(base.plan);
  draft.selections = draft.selections.filter((selection) => selection.actionId !== input.removedActionId);
  const addedSelection: PlanSelection = input.addedDistrictId === undefined
    ? { actionId: event.requiredActionId } : { actionId: event.requiredActionId, districtId: input.addedDistrictId };
  const branch = simulatePlan(replacementPlan(draft, addedSelection), catalog);
  if (!branch.valid) throw new DomainError("INVALID_REPLACEMENT", "Замена не образует допустимую пятёрку.", branch.errors);
  return { base, event, branch, comparison: comparison(base, branch) };
}
