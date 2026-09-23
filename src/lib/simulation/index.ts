import { DIRECTIONS, INDICATORS } from "../../contracts/index.ts";
import type {
  Action, Catalog, Direction, EventConfirmInput, EventConfirmResult,
  EventPreviewInput, EventPreviewResult, Indicator, Metrics, PlanInput, PlanSelection,
  SimulationResult, ValidSimulation, ValidationIssue,
} from "../../contracts/index.ts";

const EPSILON = 1e-9;
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const INDICATOR_DIRECTION: Record<Indicator, Direction> = {
  T1: "transport", T2: "transport", E1: "ecology", E2: "ecology",
  S1: "social", S2: "social", B1: "safety", B2: "safety", C1: "services", C2: "services",
};

export class DomainError extends Error {
  readonly code: string;
  readonly issues: ValidationIssue[];
  constructor(code: string, message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.issues = issues;
  }
}

const makeIssue = (code: string, message: string, actionIds: string[] = []): ValidationIssue => ({ code, message, actionIds });
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const blankMetrics = (): Metrics => Object.fromEntries(INDICATORS.map((key) => [key, 0])) as Metrics;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const nonemptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const selectionShape = (value: unknown): value is PlanSelection => record(value) && typeof value.actionId === "string" && (value.districtId === undefined || typeof value.districtId === "string");

function copiedSelections(plan: PlanInput): PlanSelection[] {
  if (!Array.isArray(plan?.selections)) return [];
  return plan.selections.filter(selectionShape).map(({ actionId, districtId }) => districtId === undefined ? { actionId } : { actionId, districtId });
}

function uniqueKnownCost(plan: PlanInput, catalog: Catalog): number {
  const ids = new Set(copiedSelections(plan).map((selection) => selection.actionId));
  const prices = new Map<string, number>();
  for (const action of Array.isArray(catalog?.actions) ? catalog.actions : []) {
    if (record(action) && typeof action.id === "string" && finite(action.cost) && action.cost >= 0 && !prices.has(action.id)) prices.set(action.id, action.cost);
  }
  return [...ids].reduce((sum, id) => sum + (prices.get(id) ?? 0), 0);
}

function catalogIssues(catalog: Catalog): ValidationIssue[] {
  if (!record(catalog) || !record(catalog.config) || !Array.isArray(catalog.actions) || !Array.isArray(catalog.districts) || !Array.isArray(catalog.conflicts) || !Array.isArray(catalog.synergies)) {
    return [makeIssue("INVALID_CATALOG", "Каталог имеет неверную структуру.")];
  }
  if (!record(catalog.config.indicatorWeights)
    || catalog.actions.some((action) => !record(action) || !nonemptyString(action.id) || !record(action.effects) || !record(action.constraints) || !Array.isArray(action.constraints.requires) || !action.constraints.requires.every(nonemptyString))
    || catalog.districts.some((district) => !record(district) || !nonemptyString(district.id) || !record(district.baseline))
    || catalog.conflicts.some((conflict) => !record(conflict) || !Array.isArray(conflict.actionIds) || !conflict.actionIds.every(nonemptyString))
    || catalog.synergies.some((synergy) => !record(synergy) || !Array.isArray(synergy.actionIds) || !synergy.actionIds.every(nonemptyString))) {
    return [makeIssue("INVALID_CATALOG", "Некорректная структура мер, районов, весов или связей каталога.")];
  }
  const errors: ValidationIssue[] = [];
  const actionIds = new Set(catalog.actions.map((action) => action.id));
  const districtIds = new Set(catalog.districts.map((district) => district.id));
  if (actionIds.size !== catalog.actions.length || districtIds.size !== catalog.districts.length) errors.push(makeIssue("INVALID_CATALOG", "ID мероприятий и районов должны быть уникальны."));
  const cfg = catalog.config;
  if (!nonemptyString(cfg.modelVersion) || !finite(cfg.budgetLimit) || cfg.budgetLimit < 0 || !Number.isInteger(cfg.decisionsRequired) || cfg.decisionsRequired <= 0 || !finite(cfg.horizonQuarters) || cfg.horizonQuarters <= 0 || cfg.lagRule !== "linear-remaining-horizon" || !finite(cfg.criticalThreshold) || !finite(cfg.criticalPenalty) || cfg.criticalPenalty < 0 || !Number.isInteger(cfg.maxActionsPerDirection) || cfg.maxActionsPerDirection <= 0 || !finite(cfg.populationAverageWeight) || !finite(cfg.weakestDistrictWeight) || cfg.populationAverageWeight < 0 || cfg.weakestDistrictWeight < 0 || Math.abs(cfg.populationAverageWeight + cfg.weakestDistrictWeight - 1) > EPSILON) {
    errors.push(makeIssue("INVALID_CATALOG", "Настройки модели или веса Score некорректны."));
  }
  const indicatorWeightSum = INDICATORS.reduce((sum, key) => sum + (cfg.indicatorWeights?.[key] ?? Number.NaN), 0);
  if (INDICATORS.some((key) => !finite(cfg.indicatorWeights?.[key]) || cfg.indicatorWeights[key] < 0) || Math.abs(indicatorWeightSum - 1) > EPSILON) errors.push(makeIssue("INVALID_CATALOG", "Веса показателей должны быть неотрицательными и суммироваться до 1."));
  const populationWeightSum = catalog.districts.reduce((sum, district) => sum + district.populationWeight, 0);
  if (catalog.districts.some((district) => !finite(district.populationWeight) || district.populationWeight < 0) || Math.abs(populationWeightSum - 1) > EPSILON) errors.push(makeIssue("INVALID_CATALOG", "Веса населения районов должны быть неотрицательными и суммироваться до 1."));
  for (const district of catalog.districts) {
    if (INDICATORS.some((key) => !finite(district.baseline?.[key]) || district.baseline[key] < 0 || district.baseline[key] > 100)) errors.push(makeIssue("INVALID_CATALOG", `Некорректные исходные показатели района ${district.id}.`));
  }
  for (const action of catalog.actions) {
    if (!finite(action.cost) || action.cost < 0 || !finite(action.lagQuarters) || action.lagQuarters < 0 || action.lagQuarters > cfg.horizonQuarters) errors.push(makeIssue("INVALID_CATALOG", `Некорректные стоимость или лаг меры ${action.id}.`, [action.id]));
    if (!DIRECTIONS.includes(action.direction) || !["district", "city"].includes(action.scope)) errors.push(makeIssue("INVALID_CATALOG", `Некорректное направление или область меры ${action.id}.`, [action.id]));
    for (const [key, value] of Object.entries(action.effects ?? {})) if (!INDICATORS.includes(key as Indicator) || !finite(value)) errors.push(makeIssue("INVALID_CATALOG", `Некорректный эффект меры ${action.id}/${key}.`, [action.id]));
    for (const requiredId of action.constraints?.requires ?? []) if (!actionIds.has(requiredId)) errors.push(makeIssue("INVALID_CATALOG", `Мера ${action.id} требует неизвестную меру ${requiredId}.`, [action.id, requiredId]));
  }
  const byId = new Map(catalog.actions.map((action) => [action.id, action]));
  for (const conflict of catalog.conflicts) {
    if (conflict.actionIds.length !== 2 || new Set(conflict.actionIds).size !== 2 || conflict.actionIds.some((id) => !actionIds.has(id))
      || !["global", "same-district"].includes(conflict.scope)
      || (conflict.scope === "same-district" && conflict.actionIds.some((id) => byId.get(id)?.scope !== "district"))) {
      errors.push(makeIssue("INVALID_CATALOG", "Конфликт содержит некорректную пару мер или область действия."));
    }
  }
  for (const synergy of catalog.synergies) {
    if (synergy.actionIds.length !== 2 || new Set(synergy.actionIds).size !== 2 || synergy.actionIds.some((id) => !actionIds.has(id))
      || !synergy.actionIds.includes(synergy.districtActionId) || byId.get(synergy.districtActionId)?.scope !== "district"
      || !INDICATORS.includes(synergy.indicator) || !finite(synergy.bonus)) {
      errors.push(makeIssue("INVALID_CATALOG", "Синергия содержит некорректную пару, районную меру или значение."));
    }
  }
  return errors;
}

function canonicalSelections(plan: PlanInput): PlanInput["selections"] {
  return plan.selections.map((selection) => ({ ...selection })).sort((a, b) => lexical(a.actionId, b.actionId) || lexical(a.districtId ?? "", b.districtId ?? ""));
}

/** Validates exact decision count, budget, target districts, directions, conflicts and requirements. */
export function validatePlan(plan: PlanInput, catalog: Catalog): ValidationIssue[] {
  const errors = catalogIssues(catalog);
  if (errors.length) return errors;
  if (!record(plan) || typeof plan.modelVersion !== "string" || !Array.isArray(plan.selections) || !plan.selections.every(selectionShape)) return [makeIssue("INVALID_PLAN", "План должен содержать версию модели и список решений с текстовыми ID.")];
  if (plan.modelVersion !== catalog.config.modelVersion) errors.push(makeIssue("MODEL_VERSION_MISMATCH", "Версия модели плана не совпадает с каталогом."));
  const selections = plan.selections;
  if (selections.length !== catalog.config.decisionsRequired) errors.push(makeIssue("INVALID_DECISION_COUNT", `Нужно принять ровно ${catalog.config.decisionsRequired} решений.`, selections.map((selection) => selection.actionId)));
  const byId = new Map(catalog.actions.map((action) => [action.id, action]));
  const counts = new Map<string, number>();
  for (const selection of selections) counts.set(selection.actionId, (counts.get(selection.actionId) ?? 0) + 1);
  for (const [id, count] of counts) if (count > 1) errors.push(makeIssue("DUPLICATE_ACTION", `Мера ${id} выбрана более одного раза.`, [id]));
  const selectedIds = new Set(counts.keys());
  const districtById = new Map(catalog.districts.map((district) => [district.id, district]));
  const selectionById = new Map(selections.map((selection) => [selection.actionId, selection]));
  const directionCounts = new Map<Direction, number>();
  for (const selection of selections) {
    const action = byId.get(selection.actionId);
    if (!action) { errors.push(makeIssue("UNKNOWN_ACTION", `Неизвестная мера ${selection.actionId}.`, [selection.actionId])); continue; }
    directionCounts.set(action.direction, (directionCounts.get(action.direction) ?? 0) + 1);
    if (action.scope === "district") {
      if (!selection.districtId) errors.push(makeIssue("DISTRICT_REQUIRED", `Для меры ${action.id} необходимо выбрать район.`, [action.id]));
      else if (!districtById.has(selection.districtId)) errors.push(makeIssue("UNKNOWN_DISTRICT", `Неизвестный район ${selection.districtId}.`, [action.id]));
    } else if (selection.districtId !== undefined) errors.push(makeIssue("DISTRICT_NOT_ALLOWED", `Для городской меры ${action.id} район указывать нельзя.`, [action.id]));
    for (const requiredId of action.constraints.requires) if (!selectedIds.has(requiredId)) errors.push(makeIssue("REQUIREMENT_MISSING", `${action.id} требует меру ${requiredId}.`, [action.id, requiredId]));
  }
  for (const [direction, count] of directionCounts) if (count > catalog.config.maxActionsPerDirection) errors.push(makeIssue("DIRECTION_LIMIT_EXCEEDED", `В направлении ${direction} выбрано больше ${catalog.config.maxActionsPerDirection} мер.`, selections.filter((selection) => byId.get(selection.actionId)?.direction === direction).map((selection) => selection.actionId)));
  for (const conflict of catalog.conflicts) {
    const [firstId, secondId] = conflict.actionIds;
    if (!selectedIds.has(firstId) || !selectedIds.has(secondId)) continue;
    if (conflict.scope === "global" || selectionById.get(firstId)?.districtId === selectionById.get(secondId)?.districtId) errors.push(makeIssue("ACTIONS_INCOMPATIBLE", `Меры ${firstId} и ${secondId} несовместимы${conflict.scope === "same-district" ? " в одном районе" : ""}.`, [firstId, secondId]));
  }
  const totalCost = uniqueKnownCost(plan, catalog);
  if (totalCost > catalog.config.budgetLimit) errors.push(makeIssue("BUDGET_EXCEEDED", `Стоимость ${totalCost} превышает бюджет ${catalog.config.budgetLimit}.`));
  return errors;
}

function districtScore(values: Metrics, catalog: Catalog): number {
  return INDICATORS.reduce((sum, indicator) => sum + catalog.config.indicatorWeights[indicator] * values[indicator], 0);
}

function aggregate(districts: Catalog["districts"], values: Metrics[]): Metrics {
  const result = blankMetrics();
  for (const indicator of INDICATORS) result[indicator] = districts.reduce((sum, district, index) => sum + district.populationWeight * values[index][indicator], 0);
  return result;
}

function scoreResult(values: Metrics[], catalog: Catalog) {
  const districtScores = catalog.districts.map((district, index) => districtScore(values[index], catalog));
  const populationWeightedAverage = districtScores.reduce((sum, score, index) => sum + catalog.districts[index].populationWeight * score, 0);
  const weakestDistrictScore = Math.min(...districtScores);
  const criticalCount = values.reduce((sum, districtValues) => sum + INDICATORS.filter((indicator) => districtValues[indicator] < catalog.config.criticalThreshold).length, 0);
  return {
    districtScores,
    populationWeightedAverage,
    weakestDistrictScore,
    criticalCount,
    score: catalog.config.populationAverageWeight * populationWeightedAverage + catalog.config.weakestDistrictWeight * weakestDistrictScore - catalog.config.criticalPenalty * criticalCount,
  };
}

function calculateValid(plan: PlanInput, catalog: Catalog): ValidSimulation {
  const selections = canonicalSelections(plan);
  const canonicalPlan: PlanInput = { modelVersion: plan.modelVersion, selections };
  const actions = new Map(catalog.actions.map((action) => [action.id, action]));
  const districts = catalog.districts;
  const afterRaw = districts.map((district) => ({ ...district.baseline }));
  const scaleFor = (action: Action) => (catalog.config.horizonQuarters - action.lagQuarters) / catalog.config.horizonQuarters;
  const trace = [];
  for (const selection of selections) {
    const action = actions.get(selection.actionId)!;
    const multiplier = scaleFor(action);
    const targetDistricts = action.scope === "city" ? districts : districts.filter((district) => district.id === selection.districtId);
    const appliedEffects: Partial<Metrics> = {};
    for (const indicator of INDICATORS) {
      const effect = (action.effects[indicator] ?? 0) * multiplier;
      if (effect !== 0) appliedEffects[indicator] = effect;
      for (const district of targetDistricts) afterRaw[districts.indexOf(district)][indicator] += effect;
    }
    trace.push({ actionId: action.id, districtId: action.scope === "city" ? null : selection.districtId!, lagQuarters: action.lagQuarters, effectMultiplier: multiplier, appliedEffects });
  }
  const synergiesApplied: { actionIds: [string, string]; districtId: string; indicator: Indicator; bonus: number }[] = [];
  const selectedIds = new Set(selections.map((selection) => selection.actionId));
  const selectionById = new Map(selections.map((selection) => [selection.actionId, selection]));
  for (const synergy of catalog.synergies) {
    if (!synergy.actionIds.every((id) => selectedIds.has(id))) continue;
    const anchorSelection = selectionById.get(synergy.districtActionId)!;
    const districtId = anchorSelection.districtId!;
    const districtIndex = districts.findIndex((district) => district.id === districtId);
    afterRaw[districtIndex][synergy.indicator] += synergy.bonus;
    synergiesApplied.push({ actionIds: [...synergy.actionIds], districtId, indicator: synergy.indicator, bonus: synergy.bonus });
  }
  const after = afterRaw.map((values) => Object.fromEntries(INDICATORS.map((indicator) => [indicator, Math.min(100, Math.max(0, values[indicator]))])) as Metrics);
  const before = districts.map((district) => ({ ...district.baseline }));
  const beforeScores = scoreResult(before, catalog);
  const afterScores = scoreResult(after, catalog);
  const districtResults = districts.map((district, index) => ({
    districtId: district.id,
    populationWeight: district.populationWeight,
    before: before[index],
    after: after[index],
    scoreBefore: beforeScores.districtScores[index],
    scoreAfter: afterScores.districtScores[index],
    scoreDelta: afterScores.districtScores[index] - beforeScores.districtScores[index],
    criticalCountBefore: INDICATORS.filter((indicator) => before[index][indicator] < catalog.config.criticalThreshold).length,
    criticalCountAfter: INDICATORS.filter((indicator) => after[index][indicator] < catalog.config.criticalThreshold).length,
  }));
  const cityIndicators = aggregate(districts, after);
  const directionWeights: Record<Direction, number> = { transport: 0, ecology: 0, social: 0, safety: 0, services: 0 };
  const directionTotals: Record<Direction, number> = { ...directionWeights };
  for (const indicator of INDICATORS) directionWeights[INDICATOR_DIRECTION[indicator]] += catalog.config.indicatorWeights[indicator] * cityIndicators[indicator];
  for (const indicator of INDICATORS) directionTotals[INDICATOR_DIRECTION[indicator]] += catalog.config.indicatorWeights[indicator];
  for (const direction of DIRECTIONS) directionWeights[direction] /= directionTotals[direction];
  const totalCost = selections.reduce((sum, selection) => sum + actions.get(selection.actionId)!.cost, 0);
  return {
    plan: canonicalPlan,
    totalCost,
    remainingBudget: catalog.config.budgetLimit - totalCost,
    warnings: [],
    valid: true,
    officialScore: afterScores.score,
    errors: [],
    metrics: {
      indicators: cityIndicators,
      directions: directionWeights,
      districts: districtResults,
      populationWeightedAverage: afterScores.populationWeightedAverage,
      weakestDistrictScore: afterScores.weakestDistrictScore,
      criticalCount: afterScores.criticalCount,
      baselineOfficialScore: beforeScores.score,
      deltaFromBaseline: afterScores.score - beforeScores.score,
      synergiesApplied,
    },
    trace,
  };
}

/** Calculates only a valid five-decision plan; invalid plans have no Score. */
export function simulatePlan(plan: PlanInput, catalog: Catalog): SimulationResult {
  const errors = validatePlan(plan, catalog);
  const totalCost = uniqueKnownCost(plan, catalog);
  if (errors.length) {
    return {
      plan: { modelVersion: typeof plan?.modelVersion === "string" ? plan.modelVersion : "", selections: copiedSelections(plan) },
      totalCost,
      remainingBudget: finite(catalog?.config?.budgetLimit) ? catalog.config.budgetLimit - totalCost : 0,
      warnings: [], valid: false, officialScore: null, errors, metrics: null, trace: [],
    };
  }
  return calculateValid(plan, catalog);
}

// The supplied organizer dataset lists no events. Preserve explicit failures for stale clients.
// The approved opt-in team scenario has separate exports/types in ./events.ts until API integration.
export function previewEvent(_input: EventPreviewInput, _catalog: Catalog): EventPreviewResult {
  const errors = [makeIssue("EVENTS_NOT_CONFIGURED", "В предоставленном наборе данных события не заданы.")];
  throw new DomainError("EVENTS_NOT_CONFIGURED", errors[0].message, errors);
}
export function confirmEvent(_input: EventConfirmInput, _catalog: Catalog): EventConfirmResult {
  const errors = [makeIssue("EVENTS_NOT_CONFIGURED", "В предоставленном наборе данных события не заданы.")];
  throw new DomainError("EVENTS_NOT_CONFIGURED", errors[0].message, errors);
}
