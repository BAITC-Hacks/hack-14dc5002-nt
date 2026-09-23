import { DIRECTIONS } from "../../contracts/index.ts";
import type {
  Action, Catalog, Comparison, DistrictResult, EventConfirmInput,
  EventConfirmResult, EventPreviewInput, EventPreviewResult, Metrics,
  PlanInput, ReplacementOption, SimulationResult, ValidSimulation,
  ValidationIssue,
} from "../../contracts/index.ts";

const EPSILON = 1e-9;
const lexical = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

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

function issue(code: string, message: string, actionIds: string[] = []): ValidationIssue {
  return { code, message, actionIds };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function catalogIssues(catalog: Catalog): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!catalog || typeof catalog !== "object" || !catalog.config || !Array.isArray(catalog.actions) || !Array.isArray(catalog.districts) || !Array.isArray(catalog.events)) {
    return [issue("INVALID_CATALOG", "Каталог имеет неверную структуру.")];
  }
  const actionIds = new Set<string>();
  const districtIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const action of catalog.actions) {
    if (!action || typeof action.id !== "string" || !action.id) {
      errors.push(issue("INVALID_CATALOG", "У мероприятия отсутствует корректный ID."));
    } else if (actionIds.has(action.id)) {
      errors.push(issue("INVALID_CATALOG", `ID мероприятия ${action.id} повторяется.`, [action.id]));
    } else actionIds.add(action.id);
  }
  for (const district of catalog.districts) {
    if (!district || typeof district.id !== "string" || !district.id) {
      errors.push(issue("INVALID_CATALOG", "У района отсутствует корректный ID."));
      continue;
    }
    if (districtIds.has(district.id)) errors.push(issue("INVALID_CATALOG", `ID района ${district.id} повторяется.`));
    districtIds.add(district.id);
    if (!isFiniteNumber(district.weight) || district.weight < 0) errors.push(issue("INVALID_CATALOG", `Некорректный вес района ${district.id}.`));
    for (const direction of DIRECTIONS) {
      if (!isFiniteNumber(district.baseline?.[direction])) errors.push(issue("INVALID_CATALOG", `Некорректная база ${district.id}/${direction}.`));
    }
  }
  for (const event of catalog.events) {
    if (!event || typeof event.id !== "string" || !event.id) errors.push(issue("INVALID_CATALOG", "У события отсутствует корректный ID."));
    else if (eventIds.has(event.id)) errors.push(issue("INVALID_CATALOG", `ID события ${event.id} повторяется.`));
    else eventIds.add(event.id);
  }
  const config = catalog.config;
  if (!config || typeof config.modelVersion !== "string" || !config.modelVersion || config.lagRule !== "step" || !isFiniteNumber(config.budgetLimit) || config.budgetLimit < 0 || !Number.isInteger(config.decisionsRequired) || config.decisionsRequired < 1 || !isFiniteNumber(config.horizonMonths) || config.horizonMonths < 0) {
    errors.push(issue("INVALID_CATALOG", "Параметры модели каталога некорректны."));
  }
  const weightSum = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
  const dimensionWeights = DIRECTIONS.map((key) => config?.dimensionWeights?.[key]);
  if (dimensionWeights.some((value) => !isFiniteNumber(value) || value < 0) || Math.abs(weightSum(dimensionWeights as number[]) - 1) > EPSILON) {
    errors.push(issue("INVALID_CATALOG", "Веса показателей должны быть неотрицательными и в сумме равняться 1."));
  }
  if (Math.abs(weightSum(catalog.districts.map((district) => district.weight)) - 1) > EPSILON) {
    errors.push(issue("INVALID_CATALOG", "Веса районов должны быть неотрицательными и в сумме равняться 1."));
  }
  for (const action of catalog.actions) {
    if (!action || typeof action.id !== "string") continue;
    if (!isFiniteNumber(action.cost) || action.cost < 0 || !isFiniteNumber(action.lagMonths) || action.lagMonths < 0) errors.push(issue("INVALID_CATALOG", `Некорректная стоимость или лаг ${action.id}.`, [action.id]));
    for (const [districtId, values] of Object.entries(action.effects ?? {})) {
      if (!districtIds.has(districtId)) errors.push(issue("INVALID_CATALOG", `Эффект ${action.id} ссылается на неизвестный район ${districtId}.`, [action.id]));
      for (const [key, value] of Object.entries(values ?? {})) {
        if (!(DIRECTIONS as readonly string[]).includes(key) || !isFiniteNumber(value)) errors.push(issue("INVALID_CATALOG", `Некорректный эффект ${action.id}/${districtId}/${key}.`, [action.id]));
      }
    }
    for (const linkedId of [...(action.constraints?.requires ?? []), ...(action.constraints?.excludes ?? [])]) {
      if (!actionIds.has(linkedId)) errors.push(issue("INVALID_CATALOG", `Ограничение ${action.id} ссылается на неизвестное мероприятие ${linkedId}.`, [action.id, linkedId]));
    }
    if (action.availability?.kind === "event" && !eventIds.has(action.availability.eventId)) errors.push(issue("INVALID_CATALOG", `Доступность ${action.id} ссылается на неизвестное событие.`, [action.id]));
  }
  for (const event of catalog.events) {
    if (event.kind === "cancellation" && !actionIds.has(event.blockedActionId)) errors.push(issue("INVALID_CATALOG", `Событие ${event.id} ссылается на неизвестное мероприятие.`));
    if (event.kind === "opportunity" && !actionIds.has(event.unlockedActionId)) errors.push(issue("INVALID_CATALOG", `Событие ${event.id} ссылается на неизвестное мероприятие.`));
  }
  return errors;
}

function uniqueKnownCost(ids: unknown, catalog: Catalog): number {
  if (!Array.isArray(ids)) return 0;
  const known = new Set<string>();
  for (const id of ids) if (typeof id === "string") known.add(id);
  return catalog.actions.reduce((sum, action) => sum + (known.has(action.id) && isFiniteNumber(action.cost) ? action.cost : 0), 0);
}

/** Validates a plan using catalog-owned prices, availability, and constraints. */
export function validatePlan(plan: PlanInput, catalog: Catalog, eventId?: string): ValidationIssue[] {
  const errors = catalogIssues(catalog);
  if (errors.length) return errors;
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.actionIds)) return [issue("INVALID_PLAN", "План должен содержать список мероприятий.")];
  const ids = plan.actionIds;
  if (plan.modelVersion !== catalog.config.modelVersion) errors.push(issue("MODEL_VERSION_MISMATCH", "Версия модели плана не совпадает с каталогом."));
  if (ids.length !== catalog.config.decisionsRequired) errors.push(issue("INVALID_DECISION_COUNT", `Нужно выбрать ровно ${catalog.config.decisionsRequired} мероприятий.`, ids.filter((id): id is string => typeof id === "string")));
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (typeof id !== "string") {
      errors.push(issue("UNKNOWN_ACTION", "ID мероприятия должен быть строкой."));
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const selected = new Set(counts.keys());
  for (const [id, count] of counts) if (count > 1) errors.push(issue("DUPLICATE_ACTION", `Мероприятие ${id} выбрано несколько раз.`, [id]));
  const actionById = new Map(catalog.actions.map((action) => [action.id, action]));
  for (const id of selected) if (!actionById.has(id)) errors.push(issue("UNKNOWN_ACTION", `Неизвестное мероприятие ${id}.`, [id]));
  const event = eventId ? catalog.events.find((candidate) => candidate.id === eventId) : undefined;
  if (eventId && !event) errors.push(issue("UNKNOWN_EVENT", `Неизвестное событие ${eventId}.`));
  for (const id of selected) {
    const action = actionById.get(id);
    if (!action) continue;
    if (action.availability.kind === "event" && action.availability.eventId !== eventId) errors.push(issue("ACTION_UNAVAILABLE", `Мероприятие ${id} еще недоступно.`, [id]));
    if (event?.kind === "cancellation" && event.blockedActionId === id) errors.push(issue("ACTION_BLOCKED", `Мероприятие ${id} заблокировано событием.`, [id]));
    for (const requiredId of action.constraints.requires) if (!selected.has(requiredId)) errors.push(issue("REQUIREMENT_MISSING", `${id} требует ${requiredId}.`, [id, requiredId]));
    for (const excludedId of action.constraints.excludes) if (selected.has(excludedId)) errors.push(issue("ACTIONS_INCOMPATIBLE", `${id} несовместимо с ${excludedId}.`, [id, excludedId]));
    for (const otherId of selected) {
      const other = actionById.get(otherId);
      if (other && other.constraints.excludes.includes(id)) errors.push(issue("ACTIONS_INCOMPATIBLE", `${otherId} несовместимо с ${id}.`, [otherId, id]));
    }
  }
  const totalCost = uniqueKnownCost(ids, catalog);
  if (totalCost > catalog.config.budgetLimit) errors.push(issue("BUDGET_EXCEEDED", `Стоимость ${totalCost} превышает бюджет ${catalog.config.budgetLimit}.`));
  return errors;
}

function blankMetrics(): Metrics {
  return { transport: 0, green: 0, social: 0, safety: 0, services: 0 };
}

function calculateValid(plan: PlanInput, catalog: Catalog): ValidSimulation {
  const ids = [...plan.actionIds].sort(lexical);
  const canonicalPlan: PlanInput = { modelVersion: plan.modelVersion, actionIds: ids };
  const actions = ids.map((id) => catalog.actions.find((action) => action.id === id) as Action);
  const totalCost = actions.reduce((sum, action) => sum + action.cost, 0);
  const trace = actions.map((action) => ({
    actionId: action.id,
    active: catalog.config.horizonMonths >= action.lagMonths,
    lagMonths: action.lagMonths,
    appliedEffects: action.effects,
  }));
  const districtResults: DistrictResult[] = catalog.districts.map((district) => {
    const before = { ...district.baseline };
    const after = blankMetrics();
    for (const direction of DIRECTIONS) {
      let value = district.baseline[direction];
      for (const action of actions) {
        if (catalog.config.horizonMonths < action.lagMonths) continue;
        value += action.effects[district.id]?.[direction] ?? 0;
      }
      after[direction] = Math.min(100, Math.max(0, value));
    }
    const scoreBefore = DIRECTIONS.reduce((sum, key) => sum + catalog.config.dimensionWeights[key] * before[key], 0);
    const scoreAfter = DIRECTIONS.reduce((sum, key) => sum + catalog.config.dimensionWeights[key] * after[key], 0);
    return { districtId: district.id, before, after, scoreBefore, scoreAfter, scoreDelta: scoreAfter - scoreBefore };
  });
  const dimensions = blankMetrics();
  for (const direction of DIRECTIONS) dimensions[direction] = districtResults.reduce((sum, district, index) => sum + catalog.districts[index].weight * district.after[direction], 0);
  const baselineOfficialScore = districtResults.reduce((sum, district, index) => sum + catalog.districts[index].weight * district.scoreBefore, 0);
  const officialScore = districtResults.reduce((sum, district, index) => sum + catalog.districts[index].weight * district.scoreAfter, 0);
  return {
    plan: canonicalPlan,
    totalCost,
    remainingBudget: catalog.config.budgetLimit - totalCost,
    warnings: [],
    valid: true,
    officialScore,
    errors: [],
    metrics: { dimensions, districts: districtResults, baselineOfficialScore, deltaFromBaseline: officialScore - baselineOfficialScore },
    trace,
  };
}

/** Simulates valid five-action plans; invalid plans never receive a Score. */
export function simulatePlan(plan: PlanInput, catalog: Catalog, eventId?: string): SimulationResult {
  const errors = validatePlan(plan, catalog, eventId);
  const totalCost = uniqueKnownCost(plan?.actionIds, catalog);
  if (errors.length) {
    return {
      plan: { modelVersion: typeof plan?.modelVersion === "string" ? plan.modelVersion : "", actionIds: Array.isArray(plan?.actionIds) ? [...plan.actionIds] : [] },
      totalCost,
      remainingBudget: catalog?.config && isFiniteNumber(catalog.config.budgetLimit) ? catalog.config.budgetLimit - totalCost : 0,
      warnings: [], valid: false, officialScore: null, errors, metrics: null, trace: [],
    };
  }
  return calculateValid(plan, catalog);
}

function requireEvent(eventId: string, catalog: Catalog) {
  const event = catalog.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new DomainError("UNKNOWN_EVENT", `Неизвестное событие ${eventId}.`, [issue("UNKNOWN_EVENT", `Неизвестное событие ${eventId}.`)]);
  return event;
}

function requireValidBase(basePlan: PlanInput, catalog: Catalog): ValidSimulation {
  const base = simulatePlan(basePlan, catalog);
  if (!base.valid) throw new DomainError("INVALID_BASE_PLAN", "Исходный план события недопустим.", base.errors);
  return base;
}

function requireValidBranch(plan: PlanInput, catalog: Catalog, eventId: string): ValidSimulation {
  const branch = simulatePlan(plan, catalog, eventId);
  if (!branch.valid) throw new DomainError("INVALID_EVENT_SWAP", "Замена не образует допустимый план.", branch.errors);
  return branch;
}

function comparison(base: ValidSimulation, branch: ValidSimulation, catalog: Catalog): Comparison {
  const dimensionsDelta = blankMetrics();
  for (const direction of DIRECTIONS) dimensionsDelta[direction] = branch.metrics.dimensions[direction] - base.metrics.dimensions[direction];
  const districts = catalog.districts.map((district) => {
    const before = base.metrics.districts.find((item) => item.districtId === district.id)!;
    const after = branch.metrics.districts.find((item) => item.districtId === district.id)!;
    const districtDimensionsDelta = blankMetrics();
    for (const direction of DIRECTIONS) districtDimensionsDelta[direction] = after.after[direction] - before.after[direction];
    return { districtId: district.id, scoreDelta: after.scoreAfter - before.scoreAfter, dimensionsDelta: districtDimensionsDelta };
  });
  return { scoreDelta: branch.officialScore - base.officialScore, dimensionsDelta, districts };
}

function sortAndLimit(options: ReplacementOption[]): ReplacementOption[] {
  return options.sort((left, right) => {
    const scoreDifference = Math.round(right.result.officialScore * 1e9) - Math.round(left.result.officialScore * 1e9);
    return scoreDifference || left.result.totalCost - right.result.totalCost || lexical(left.addedActionId, right.addedActionId) || lexical(left.removedActionId, right.removedActionId);
  }).slice(0, 3);
}

function planForSwap(base: ValidSimulation, removedActionId: string, addedActionId: string): PlanInput {
  return {
    modelVersion: base.plan.modelVersion,
    actionIds: base.plan.actionIds.filter((id) => id !== removedActionId).concat(addedActionId),
  };
}

function recommendations(base: ValidSimulation, event: Catalog["events"][number], catalog: Catalog): ReplacementOption[] {
  const removedIds = event.kind === "cancellation" ? [event.blockedActionId] : base.plan.actionIds;
  const fixedAddedId = event.kind === "opportunity" ? event.unlockedActionId : undefined;
  const candidates = fixedAddedId
    ? catalog.actions.filter((action) => action.id === fixedAddedId)
    : catalog.actions.filter((action) => action.availability.kind === "always");
  const options: ReplacementOption[] = [];
  for (const removedActionId of removedIds) {
    for (const action of candidates) {
      if (base.plan.actionIds.includes(action.id)) continue;
      const nextPlan = planForSwap(base, removedActionId, action.id);
      const result = simulatePlan(nextPlan, catalog, event.id);
      if (!result.valid) continue;
      options.push({
        removedActionId,
        addedActionId: action.id,
        plan: result.plan,
        result,
        comparison: comparison(base, result, catalog),
      });
    }
  }
  return sortAndLimit(options);
}

/** Creates a separate, deterministic preview branch for a catalog event. */
export function previewEvent(input: EventPreviewInput, catalog: Catalog): EventPreviewResult {
  if (!input || typeof input.eventId !== "string") throw new DomainError("UNKNOWN_EVENT", "Не указано корректное событие.");
  const event = requireEvent(input.eventId, catalog);
  const base = requireValidBase(input.basePlan, catalog);
  if (event.kind === "cancellation" && !base.plan.actionIds.includes(event.blockedActionId)) {
    throw new DomainError("EVENT_NOT_APPLICABLE", "Отменяемое мероприятие отсутствует в исходном плане.", [issue("EVENT_NOT_APPLICABLE", "Событие отмены неприменимо к исходному плану.", [event.blockedActionId])]);
  }
  const draft: PlanInput = event.kind === "cancellation"
    ? { modelVersion: base.plan.modelVersion, actionIds: base.plan.actionIds.filter((id) => id !== event.blockedActionId) }
    : { modelVersion: base.plan.modelVersion, actionIds: [...base.plan.actionIds] };
  const draftResult = simulatePlan(draft, catalog);
  return { base, event, draft, draftResult, requiresReplacement: true, replacementOptions: recommendations(base, event, catalog) };
}

/** Revalidates an event swap from catalog data and returns a fresh comparison. */
export function confirmEvent(input: EventConfirmInput, catalog: Catalog): EventConfirmResult {
  if (!input || typeof input.eventId !== "string") throw new DomainError("UNKNOWN_EVENT", "Не указано корректное событие.");
  const event = requireEvent(input.eventId, catalog);
  const base = requireValidBase(input.basePlan, catalog);
  const { removedActionId, addedActionId } = input;
  const baseIds = base.plan.actionIds;
  if (typeof removedActionId !== "string" || typeof addedActionId !== "string" || !baseIds.includes(removedActionId) || baseIds.includes(addedActionId)) {
    throw new DomainError("INVALID_EVENT_SWAP", "Укажите одно выбранное мероприятие для удаления и одно новое для добавления.", [issue("INVALID_EVENT_SWAP", "Пара замены не соответствует исходной пятерке.", [removedActionId, addedActionId].filter((id): id is string => typeof id === "string"))]);
  }
  if (event.kind === "cancellation" && removedActionId !== event.blockedActionId) {
    throw new DomainError("INVALID_EVENT_SWAP", "Событие разрешает заменить только отмененное мероприятие.", [issue("INVALID_EVENT_SWAP", "Удаляемое мероприятие не совпадает с отмененным.", [removedActionId, event.blockedActionId])]);
  }
  if (event.kind === "opportunity" && addedActionId !== event.unlockedActionId) {
    throw new DomainError("INVALID_EVENT_SWAP", "Событие разрешает добавить только открывшееся мероприятие.", [issue("INVALID_EVENT_SWAP", "Добавляемое мероприятие не совпадает с открывшимся.", [addedActionId, event.unlockedActionId])]);
  }
  const candidatePlan = planForSwap(base, removedActionId, addedActionId);
  const branch = requireValidBranch(candidatePlan, catalog, event.id);
  return { base, event, branch, comparison: comparison(base, branch, catalog) };
}
