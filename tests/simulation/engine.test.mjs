import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DomainError, validatePlan, simulatePlan, previewEvent, confirmEvent } from "../../src/lib/simulation/index.ts";

const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("src/data/catalog.json", root), "utf8"));
const plan = (selections, modelVersion = catalog.config.modelVersion) => ({ modelVersion, selections });
const clone = (value) => structuredClone(value);
const selection = (actionId, districtId) => districtId ? { actionId, districtId } : { actionId };
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test("organizer example reproduces price, baseline, score, and fixed synergy", () => {
  const result = simulatePlan(catalog.demoPlan, catalog);
  assert.equal(result.valid, true);
  assert.equal(result.totalCost, 95);
  close(result.metrics.baselineOfficialScore, 52.55768);
  close(result.metrics.populationWeightedAverage, 58.0776);
  close(result.metrics.weakestDistrictScore, 52.9625);
  assert.equal(result.metrics.criticalCount, 0);
  close(result.officialScore, 56.54307);
  close(result.metrics.deltaFromBaseline, 3.98539);
  assert.deepEqual(result.metrics.synergiesApplied, [{ actionIds: ["M10", "M12"], districtId: "nura", indicator: "B1", bonus: 2 }]);
});

test("four or six decisions never receive a partial Score", () => {
  for (const selections of [catalog.demoPlan.selections.slice(0, 4), [...catalog.demoPlan.selections, selection("M1", "esil")]]) {
    const result = simulatePlan(plan(selections), catalog);
    assert.equal(result.valid, false);
    assert.equal(result.officialScore, null);
    assert.equal(result.metrics, null);
    assert.deepEqual(result.trace, []);
  }
});

test("budget limit is inclusive and over-budget portfolios are invalid", () => {
  const custom = clone(catalog);
  const selections = catalog.demoPlan.selections;
  custom.actions.find((action) => action.id === "M5").cost = 30;
  const atLimit = simulatePlan(plan(selections), custom);
  assert.equal(atLimit.totalCost, 100);
  assert.equal(atLimit.valid, true);
  custom.actions.find((action) => action.id === "M5").cost = 31;
  const over = simulatePlan(plan(selections), custom);
  assert.equal(over.valid, false);
  assert.ok(over.errors.some((entry) => entry.code === "BUDGET_EXCEEDED"));
});

test("duplicates and unknown measures are rejected without inflating invalid cost", () => {
  const duplicated = simulatePlan(plan([selection("M7", "nura"), selection("M7", "nura"), selection("M10", "nura"), selection("M12"), selection("M5", "saryarka")]), catalog);
  assert.equal(duplicated.valid, false);
  assert.ok(duplicated.errors.some((entry) => entry.code === "DUPLICATE_ACTION"));
  assert.equal(duplicated.totalCost, 75);
  const unknown = simulatePlan(plan([selection("M7", "nura"), selection("M10", "nura"), selection("M12"), selection("M5", "saryarka"), selection("M99", "nura")]), catalog);
  assert.equal(unknown.valid, false);
  assert.ok(unknown.errors.some((entry) => entry.code === "UNKNOWN_ACTION"));
  assert.equal(unknown.totalCost, 75);
});

test("district targets are required for district actions and forbidden for city actions", () => {
  const missing = clone(catalog.demoPlan);
  missing.selections[0] = selection("M7");
  assert.ok(validatePlan(missing, catalog).some((entry) => entry.code === "DISTRICT_REQUIRED"));
  const cityTarget = clone(catalog.demoPlan);
  cityTarget.selections.find((item) => item.actionId === "M12").districtId = "nura";
  assert.ok(validatePlan(cityTarget, catalog).some((entry) => entry.code === "DISTRICT_NOT_ALLOWED"));
  const badDistrict = clone(catalog.demoPlan);
  badDistrict.selections[0].districtId = "unknown";
  assert.ok(validatePlan(badDistrict, catalog).some((entry) => entry.code === "UNKNOWN_DISTRICT"));
});

test("direction limit is two; five decisions therefore span at least three directions", () => {
  const tooMany = plan([selection("M1", "esil"), selection("M2"), selection("M3", "almaty"), selection("M10", "nura"), selection("M12")]);
  const errors = validatePlan(tooMany, catalog);
  assert.ok(errors.some((entry) => entry.code === "DIRECTION_LIMIT_EXCEEDED"));
  assert.equal(validatePlan(catalog.demoPlan, catalog).length, 0);
});

test("global and same-district conflicts follow their distinct scopes", () => {
  const globalConflict = plan([selection("M1", "esil"), selection("M3", "nura"), selection("M7", "nura"), selection("M10", "almaty"), selection("M12")]);
  assert.ok(validatePlan(globalConflict, catalog).some((entry) => entry.code === "ACTIONS_INCOMPATIBLE"));
  const localConflict = plan([selection("M4", "nura"), selection("M7", "nura"), selection("M10", "esil"), selection("M12"), selection("M5", "saryarka")]);
  assert.ok(validatePlan(localConflict, catalog).some((entry) => entry.code === "ACTIONS_INCOMPATIBLE"));
  const distinctDistricts = plan([selection("M4", "saryarka"), selection("M7", "nura"), selection("M9", "nura"), selection("M10", "almaty"), selection("M12")]);
  assert.equal(validatePlan(distinctDistricts, catalog).length, 0);
});

test("linear lag scales effects; zero lag is full and lag eight is zero", () => {
  const result = simulatePlan(catalog.demoPlan, catalog);
  assert.equal(result.trace.find((item) => item.actionId === "M10").effectMultiplier, 7 / 8);
  const custom = clone(catalog);
  custom.actions.find((item) => item.id === "M12").lagQuarters = 8;
  const delayed = simulatePlan(catalog.demoPlan, custom);
  assert.equal(delayed.trace.find((item) => item.actionId === "M12").effectMultiplier, 0);
  assert.equal(delayed.trace.find((item) => item.actionId === "M12").appliedEffects.C2, undefined);
  custom.actions.find((item) => item.id === "M12").lagQuarters = 0;
  const immediate = simulatePlan(catalog.demoPlan, custom);
  assert.equal(immediate.trace.find((item) => item.actionId === "M12").effectMultiplier, 1);
  assert.equal(immediate.trace.find((item) => item.actionId === "M12").appliedEffects.C2, 5);
});

test("negative effects apply and clamping occurs once after all scaled effects sum", () => {
  const custom = clone(catalog);
  custom.districts[0].baseline.T1 = 99;
  custom.actions.find((item) => item.id === "M2").effects = { T1: 4 };
  custom.actions.find((item) => item.id === "M11").effects = { T1: -2 };
  const customPlan = plan([selection("M2"), selection("M11", "esil"), selection("M4", "baikonur"), selection("M7", "almaty"), selection("M12")]);
  const result = simulatePlan(customPlan, custom);
  assert.equal(result.valid, true);
  assert.equal(result.metrics.districts.find((item) => item.districtId === "esil").after.T1, 100);
  assert.equal(result.trace.find((item) => item.actionId === "M11").appliedEffects.T1, -1.75);
});

test("critical threshold is strict: 39.999 counts while 40 does not", () => {
  const custom = clone(catalog);
  custom.districts[0].baseline.T1 = 40;
  const before = simulatePlan(custom.demoPlan, custom);
  assert.equal(before.metrics.districts.find((item) => item.districtId === "esil").criticalCountBefore, 0);
  custom.districts[0].baseline.T1 = 39.999;
  const below = simulatePlan(custom.demoPlan, custom);
  assert.equal(below.metrics.districts.find((item) => item.districtId === "esil").criticalCountBefore, 1);
});

test("changing selection order does not change results and inputs are never mutated", () => {
  const input = clone(catalog.demoPlan);
  input.selections.reverse();
  const beforePlan = clone(input);
  const beforeCatalog = clone(catalog);
  const first = simulatePlan(input, catalog);
  const reordered = simulatePlan(plan([...input.selections].reverse()), catalog);
  assert.deepEqual(first, reordered);
  assert.deepEqual(input, beforePlan);
  assert.deepEqual(catalog, beforeCatalog);
});

test("catalog validation rejects invalid weights and event endpoints are explicit about missing event data", () => {
  const custom = clone(catalog);
  custom.districts[0].populationWeight = -1;
  assert.ok(validatePlan(catalog.demoPlan, custom).some((entry) => entry.code === "INVALID_CATALOG"));
  assert.throws(() => previewEvent({ basePlan: catalog.demoPlan, eventId: "anything" }, catalog), (error) => error instanceof DomainError && error.code === "EVENTS_NOT_CONFIGURED");
  assert.throws(() => confirmEvent({ basePlan: catalog.demoPlan, eventId: "anything", removedActionId: "M7", addedActionId: "M2" }, catalog), (error) => error instanceof DomainError && error.code === "EVENTS_NOT_CONFIGURED");
});
