import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DomainError, validatePlan, simulatePlan, previewEvent, confirmEvent } from "../../src/lib/simulation/index.ts";

const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("src/data/catalog.json", root), "utf8"));
const demoPlan = catalog.demoPlan;
const plan = (actionIds, modelVersion = catalog.config.modelVersion) => ({ modelVersion, actionIds });
const clone = (value) => structuredClone(value);
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test("demo plan has five actions, costs 90, and scores 57.0", () => {
  const result = simulatePlan(demoPlan, catalog);
  assert.equal(result.valid, true);
  assert.equal(result.totalCost, 90);
  close(result.officialScore, 57);
});

test("four and six actions remain invalid without an official result", () => {
  for (const ids of [demoPlan.actionIds.slice(0, 4), [...demoPlan.actionIds, "bus_fleet"]]) {
    const result = simulatePlan(plan(ids), catalog);
    assert.equal(result.valid, false);
    assert.equal(result.officialScore, null);
    assert.equal(result.metrics, null);
    assert.deepEqual(result.trace, []);
  }
});

test("exact budget limit is accepted; exceeding it is rejected", () => {
  const custom = clone(catalog);
  const ids = ["bus_lanes", "park_local", "school_new", "lighting_smart", "services_online"];
  const five = new Set(ids);
  let assigned = false;
  for (const action of custom.actions) {
    if (five.has(action.id) && !assigned) { action.cost += 10; assigned = true; break; }
  }
  const atLimit = simulatePlan(plan(ids), custom);
  assert.equal(atLimit.totalCost, 100);
  assert.equal(atLimit.valid, true);
  custom.actions.find((action) => action.id === "bus_lanes").cost += 1;
  const over = simulatePlan(plan(ids), custom);
  assert.equal(over.valid, false);
  assert.ok(over.errors.some((entry) => entry.code === "BUDGET_EXCEEDED"));
});

test("duplicates and unknown IDs are errors and only known unique IDs count toward cost", () => {
  const duplicated = simulatePlan(plan(["bus_lanes", "bus_lanes", "park_local", "school_new", "lighting_smart"]), catalog);
  assert.equal(duplicated.valid, false);
  assert.ok(duplicated.errors.some((entry) => entry.code === "DUPLICATE_ACTION"));
  assert.equal(duplicated.totalCost, 76);
  const unknown = simulatePlan(plan(["bus_lanes", "park_local", "school_new", "lighting_smart", "not-real"]), catalog);
  assert.equal(unknown.valid, false);
  assert.ok(unknown.errors.some((entry) => entry.code === "UNKNOWN_ACTION"));
  assert.equal(unknown.totalCost, 76);
});

test("model version, requires, and exclusions are enforced in both directions", () => {
  assert.ok(validatePlan(plan(demoPlan.actionIds, "other-model"), catalog).some((entry) => entry.code === "MODEL_VERSION_MISMATCH"));
  const missingRequires = clone(catalog);
  missingRequires.actions.find((action) => action.id === "bus_fleet").constraints.requires = ["park_local"];
  assert.ok(validatePlan(plan(["bus_lanes", "bus_fleet", "school_new", "lighting_smart", "services_online"]), missingRequires).some((entry) => entry.code === "REQUIREMENT_MISSING"));
  const bothSchools = plan(["bus_lanes", "school_new", "school_modular", "lighting_smart", "services_online"]);
  assert.ok(validatePlan(bothSchools, catalog).filter((entry) => entry.code === "ACTIONS_INCOMPATIBLE").length >= 2);
});

test("event-only action requires matching event context", () => {
  const withGrant = plan(["bus_lanes", "digital_grant", "park_local", "school_new", "services_online"]);
  assert.ok(validatePlan(withGrant, catalog).some((entry) => entry.code === "ACTION_UNAVAILABLE"));
  assert.equal(validatePlan(withGrant, catalog, "digital_grant_available").length, 0);
});

test("lag is stepwise: inactive before horizon, active at and after lag", () => {
  const custom = clone(catalog);
  custom.config.horizonMonths = 2;
  const ids = ["bus_lanes", "green_longterm", "school_new", "lighting_smart", "services_online"];
  const result = simulatePlan(plan(ids), custom);
  assert.equal(result.valid, true);
  const delayed = result.trace.find((entry) => entry.actionId === "green_longterm");
  assert.equal(delayed.active, false);
  custom.config.horizonMonths = 18;
  const atLag = simulatePlan(plan(ids), custom);
  assert.equal(atLag.trace.find((entry) => entry.actionId === "green_longterm").active, true);
  custom.config.horizonMonths = 19;
  const afterLag = simulatePlan(plan(ids), custom);
  assert.equal(afterLag.trace.find((entry) => entry.actionId === "green_longterm").active, true);
});

test("negative effects are applied and values clamp once after summing", () => {
  const custom = clone(catalog);
  custom.districts = [custom.districts[0]];
  custom.districts[0].weight = 1;
  custom.config.dimensionWeights = { transport: 1, green: 0, social: 0, safety: 0, services: 0 };
  custom.actions = custom.actions.map((action) => ({ ...action, effects: {} }));
  const actions = ["bus_lanes", "bus_fleet", "traffic_signals", "park_local", "tree_belts"];
  for (const action of custom.actions) if (actions.includes(action.id)) action.effects = { D1: { transport: action.id === "bus_lanes" ? 40 : action.id === "bus_fleet" ? 30 : action.id === "traffic_signals" ? -80 : 0 } };
  const result = simulatePlan(plan(actions), custom);
  assert.equal(result.valid, true);
  assert.equal(result.metrics.districts[0].after.transport, 35);
  const negativeTrace = result.trace.find((entry) => entry.actionId === "traffic_signals");
  assert.equal(negativeTrace.appliedEffects.D1.transport, -80);
  custom.actions.find((action) => action.id === "bus_fleet").effects.D1.transport = 100;
  custom.actions.find((action) => action.id === "traffic_signals").effects.D1.transport = -10;
  const clamped = simulatePlan(plan(actions), custom);
  assert.equal(clamped.metrics.districts[0].after.transport, 100);
});

test("order does not affect result, and neither plan nor catalog is mutated", () => {
  const input = plan([...demoPlan.actionIds].reverse());
  const inputBefore = clone(input);
  const catalogBefore = clone(catalog);
  const first = simulatePlan(input, catalog);
  const second = simulatePlan(plan([...input.actionIds].reverse()), catalog);
  assert.deepEqual(first, second);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(catalog, catalogBefore);
  assert.deepEqual(first.plan.actionIds, [...demoPlan.actionIds].sort((a, b) => a.localeCompare(b)));
});

test("malformed catalogue is rejected", () => {
  const custom = clone(catalog);
  custom.districts[0].weight = -1;
  assert.ok(validatePlan(demoPlan, custom).some((entry) => entry.code === "INVALID_CATALOG"));
});

test("cancellation preview preserves base, returns a four-action draft, and uses freed budget", () => {
  const input = { basePlan: clone(demoPlan), eventId: "school_site_unavailable" };
  const inputBefore = clone(input);
  const baseSnapshot = simulatePlan(input.basePlan, catalog);
  const preview = previewEvent(input, catalog);
  assert.equal(preview.base.totalCost, 90);
  close(preview.base.officialScore, 57);
  assert.equal(preview.draft.actionIds.length, 4);
  assert.equal(preview.draftResult.valid, false);
  assert.equal(preview.draftResult.officialScore, null);
  assert.equal(preview.draftResult.metrics, null);
  assert.equal(preview.draftResult.remainingBudget, 40);
  assert.ok(preview.replacementOptions.length <= 3);
  assert.ok(preview.replacementOptions.every((option) => option.result.valid && option.plan.actionIds.length === 5));
  assert.ok(preview.replacementOptions.some((option) => option.addedActionId === "school_modular" && option.result.totalCost === 96));
  const modular = preview.replacementOptions.find((option) => option.addedActionId === "school_modular");
  close(modular.result.officialScore, 56.6);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(preview.base, baseSnapshot);
});

test("cancellation confirmation recalculates selected replacement and comparison", () => {
  const input = { basePlan: clone(demoPlan), eventId: "school_site_unavailable", removedActionId: "school_new", addedActionId: "school_modular" };
  const original = clone(input);
  const baseSnapshot = simulatePlan(input.basePlan, catalog);
  const result = confirmEvent(input, catalog);
  assert.equal(result.base.totalCost, 90);
  close(result.base.officialScore, 57);
  assert.equal(result.branch.totalCost, 96);
  close(result.branch.officialScore, 56.6);
  close(result.comparison.scoreDelta, -0.4);
  assert.deepEqual(input, original);
  assert.deepEqual(result.base, baseSnapshot);
});

test("events reject unknown, inapplicable, malformed, and inconsistent swaps", () => {
  assert.throws(() => previewEvent({ basePlan: demoPlan, eventId: "no-such-event" }, catalog), (error) => error instanceof DomainError && error.code === "UNKNOWN_EVENT");
  const otherBase = plan(["bus_lanes", "bus_fleet", "park_local", "lighting_smart", "services_online"]);
  assert.throws(() => previewEvent({ basePlan: otherBase, eventId: "school_site_unavailable" }, catalog), (error) => error instanceof DomainError && error.code === "EVENT_NOT_APPLICABLE");
  assert.throws(() => confirmEvent({ basePlan: demoPlan, eventId: "school_site_unavailable", removedActionId: "park_local", addedActionId: "bus_fleet" }, catalog), (error) => error instanceof DomainError && error.code === "INVALID_EVENT_SWAP");
  assert.throws(() => confirmEvent({ basePlan: demoPlan, eventId: "school_site_unavailable", removedActionId: "school_new", addedActionId: "school_new" }, catalog), (error) => error instanceof DomainError && error.code === "INVALID_EVENT_SWAP");
});

test("cancellation offers no invalid or unaffordable alternatives", () => {
  const custom = clone(catalog);
  for (const action of custom.actions) if (!demoPlan.actionIds.includes(action.id)) action.cost = 1000;
  const preview = previewEvent({ basePlan: demoPlan, eventId: "school_site_unavailable" }, custom);
  assert.deepEqual(preview.replacementOptions, []);
});

test("equal recommendation scores have deterministic cost and ID ordering", () => {
  const custom = clone(catalog);
  for (const action of custom.actions) {
    action.cost = 10;
    action.effects = {};
  }
  const preview = previewEvent({ basePlan: demoPlan, eventId: "school_site_unavailable" }, custom);
  assert.deepEqual(preview.replacementOptions.map((option) => option.addedActionId), ["bus_fleet", "classes_rental", "clinic_outreach"]);
});

test("opportunity replaces one existing action and confirms only the unlocked action", () => {
  const input = { basePlan: clone(demoPlan), eventId: "digital_grant_available" };
  const inputBefore = clone(input);
  const preview = previewEvent(input, catalog);
  assert.equal(preview.draftResult.valid, true);
  assert.equal(preview.draft.actionIds.length, 5);
  assert.ok(preview.replacementOptions.every((option) => option.plan.actionIds.length === 5 && option.addedActionId === "digital_grant"));
  assert.ok(preview.replacementOptions.length <= 3);
  const confirmed = confirmEvent({ ...input, removedActionId: "bus_lanes", addedActionId: "digital_grant" }, catalog);
  assert.equal(confirmed.branch.valid, true);
  assert.equal(confirmed.branch.plan.actionIds.length, 5);
  assert.equal(confirmed.branch.plan.actionIds.includes("bus_lanes"), false);
  assert.equal(confirmed.branch.plan.actionIds.includes("digital_grant"), true);
  assert.deepEqual(input, inputBefore);
  assert.throws(() => confirmEvent({ ...input, removedActionId: "bus_lanes", addedActionId: "bus_fleet" }, catalog), (error) => error instanceof DomainError && error.code === "INVALID_EVENT_SWAP");
});
