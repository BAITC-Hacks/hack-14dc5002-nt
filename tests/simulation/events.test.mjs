import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DomainError, simulatePlan } from "../../src/lib/simulation/index.ts";
import { previewEvent, confirmEvent } from "../../src/lib/simulation/events.ts";
import { SCHOOL_CANCELLATION_EVENT } from "../../src/data/team-events.ts";

const catalog = JSON.parse(await readFile(new URL("../../src/data/organizer-catalog.json", import.meta.url), "utf8"));
const request = (basePlan = catalog.demoPlan) => ({ basePlan, eventId: "cancel-m7", eventVersion: "team-events-v1" });
const hasCode = (code) => (error) => error instanceof DomainError && error.code === code;
const replacement = (addedActionId = "M9", addedDistrictId = "nura", basePlan = catalog.demoPlan) => ({
  ...request(basePlan), removedActionId: "M7", addedActionId,
  ...(addedDistrictId === undefined ? {} : { addedDistrictId }),
});
const rejectsReplacement = (input, code, custom = catalog) => assert.throws(() => confirmEvent(input, custom),
  (error) => error instanceof DomainError && error.code === "INVALID_REPLACEMENT" && error.issues.some((issue) => issue.code === code));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} differs from ${expected}`);
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test("M7 cancellation preserves the base and refunds 24 plus the previous 5", () => {
  const original = simulatePlan(catalog.demoPlan, catalog);
  const preview = previewEvent(request(), catalog);
  assert.deepEqual(preview.base, original);
  assert.equal(preview.refundAmount, 24);
  assert.equal(preview.availableBudget, 29);
  assert.equal(preview.draftResult.totalCost, 71);
  assert.equal(preview.availableBudget, original.remainingBudget + preview.refundAmount);
  assert.equal(preview.draft.selections.length, 4);
  assert.equal(preview.draft.selections.some((item) => item.actionId === "M7"), false);
  assert.equal(preview.draftResult.valid, false);
  assert.equal(preview.draftResult.officialScore, null);
  assert.equal(preview.draftResult.metrics, null);
  assert.deepEqual(preview.draftResult.trace, []);
  assert.equal(preview.event.source, "team-scenario");
  close(preview.base.officialScore, 56.54307);
});

test("preview returns three distinct fully validated replacement measures", () => {
  const preview = previewEvent(request(), catalog);
  assert.equal(preview.replacementOptions.length, 3);
  assert.equal(new Set(preview.replacementOptions.map((option) => option.addedActionId)).size, 3);
  for (const option of preview.replacementOptions) {
    assert.equal(option.removedActionId, "M7");
    assert.notEqual(option.addedActionId, "M7");
    assert.equal(option.plan.selections.length, 5);
    assert.equal(new Set(option.plan.selections.map((item) => item.actionId)).size, 5);
    assert.ok(option.result.totalCost <= 100);
    assert.deepEqual(option.result, simulatePlan(option.plan, catalog));
    assert.ok(option.plan.selections.some((item) => item.actionId === option.addedSelection.actionId && item.districtId === option.addedSelection.districtId));
    close(option.comparison.scoreDelta, option.result.officialScore - preview.base.officialScore);
  }
  assert.deepEqual(preview.replacementOptions.map((option) => option.addedActionId), ["M9", "M14", "M2"]);
  assert.deepEqual(preview.replacementOptions[0].addedSelection, { actionId: "M9", districtId: "nura" });
  close(preview.replacementOptions[0].result.officialScore, 56.425135);
});

test("event requires a valid original five, known event, matching versions and selected M7", () => {
  for (const malformed of [null, {}, { eventId: "cancel-m7" }, { ...request(), eventVersion: 1 }]) {
    assert.throws(() => previewEvent(malformed, catalog), hasCode("INVALID_EVENT_INPUT"));
  }
  assert.throws(() => previewEvent({ ...request(), eventId: "unknown" }, catalog), hasCode("UNKNOWN_EVENT"));
  assert.throws(() => previewEvent({ ...request(), eventVersion: "outdated" }, catalog), hasCode("EVENT_VERSION_MISMATCH"));
  for (const basePlan of [null, { ...catalog.demoPlan, selections: catalog.demoPlan.selections.slice(1) },
    { ...catalog.demoPlan, selections: [...catalog.demoPlan.selections, { actionId: "M14" }] }]) {
    assert.throws(() => previewEvent(request(basePlan), catalog), hasCode("INVALID_BASE_PLAN"));
  }
  const noSchool = structuredClone(catalog.demoPlan);
  noSchool.selections[0] = { actionId: "M9", districtId: "nura" };
  assert.throws(() => previewEvent(request(noSchool), catalog), hasCode("EVENT_NOT_APPLICABLE"));
  const anotherModel = structuredClone(catalog);
  anotherModel.config.modelVersion = "future-model";
  const base = { ...catalog.demoPlan, modelVersion: "future-model" };
  assert.throws(() => previewEvent(request(base), anotherModel), hasCode("EVENT_MODEL_MISMATCH"));
});

test("no valid replacements yields an empty list, never an approximate result", () => {
  const custom = structuredClone(catalog);
  custom.actions.find((action) => action.id === "M8").constraints.requires = ["M7"];
  const preview = previewEvent(request(), custom);
  assert.equal(preview.base.valid, true);
  assert.deepEqual(preview.replacementOptions, []);
  assert.equal(preview.draftResult.officialScore, null);
  assert.ok(preview.draftResult.errors.some((issue) => issue.code === "REQUIREMENT_MISSING"));
});

test("preview is deterministic with frozen inputs and returns independent snapshots", () => {
  const immutableCatalog = freeze(structuredClone(catalog));
  const immutableInput = freeze(request(structuredClone(catalog.demoPlan)));
  const first = previewEvent(immutableInput, immutableCatalog);
  const second = previewEvent(immutableInput, immutableCatalog);
  assert.deepEqual(first, second);
  assert.deepEqual(first, previewEvent({ ...immutableInput, basePlan: {
    ...immutableInput.basePlan, selections: [...immutableInput.basePlan.selections].reverse(),
  } }, immutableCatalog));
  const reversed = structuredClone(catalog);
  reversed.actions.reverse();
  assert.deepEqual(first, previewEvent(immutableInput, reversed));
  first.draft.selections[0].actionId = "tampered";
  first.replacementOptions[0].plan.selections[0].actionId = "tampered";
  first.replacementOptions[0].result.metrics.districts[0].after.T1 = -999;
  first.event.replacementActionIds.length = 0;
  assert.deepEqual(first.base, second.base);
  assert.deepEqual(previewEvent(immutableInput, immutableCatalog), second);
  assert.equal(SCHOOL_CANCELLATION_EVENT.replacementActionIds.length, 13);
});

test("confirm reproduces each recommendation and all comparison deltas", () => {
  const preview = previewEvent(request(), catalog);
  for (const option of preview.replacementOptions) {
    const input = { ...request(), removedActionId: option.removedActionId, addedActionId: option.addedActionId,
      ...(option.addedSelection.districtId === undefined ? {} : { addedDistrictId: option.addedSelection.districtId }),
    };
    const confirmed = confirmEvent(input, catalog);
    assert.deepEqual(confirmed.base, preview.base);
    assert.deepEqual(confirmed.branch, option.result);
    assert.deepEqual(confirmed.comparison, option.comparison);
    assert.equal(confirmed.branch.plan.selections.length, 5);
    for (const indicator of Object.keys(confirmed.comparison.indicatorsDelta)) {
      close(confirmed.comparison.indicatorsDelta[indicator],
        confirmed.branch.metrics.indicators[indicator] - confirmed.base.metrics.indicators[indicator]);
    }
    for (const district of confirmed.comparison.districts) {
      const before = confirmed.base.metrics.districts.find((item) => item.districtId === district.districtId);
      const after = confirmed.branch.metrics.districts.find((item) => item.districtId === district.districtId);
      close(district.scoreDelta, after.scoreAfter - before.scoreAfter);
      for (const indicator of Object.keys(district.indicatorsDelta)) {
        close(district.indicatorsDelta[indicator], after.after[indicator] - before.after[indicator]);
      }
    }
  }
});

test("confirm validates request shape, event applicability and the removed action", () => {
  for (const input of [null, {}, { ...replacement(), removedActionId: 7 }, { ...replacement(), addedActionId: "" },
    { ...replacement(), addedDistrictId: null }]) {
    assert.throws(() => confirmEvent(input, catalog), hasCode("INVALID_REPLACEMENT_INPUT"));
  }
  assert.throws(() => confirmEvent({ ...replacement(), eventVersion: "old" }, catalog), hasCode("EVENT_VERSION_MISMATCH"));
  assert.throws(() => confirmEvent({ ...replacement(), eventId: "other" }, catalog), hasCode("UNKNOWN_EVENT"));
  assert.throws(() => confirmEvent({ ...replacement(), removedActionId: "M8" }, catalog), hasCode("INVALID_REMOVAL"));
  assert.throws(() => confirmEvent({ ...replacement(), basePlan: null }, catalog), hasCode("INVALID_BASE_PLAN"));
  const noSchool = structuredClone(catalog.demoPlan);
  noSchool.selections[0] = { actionId: "M9", districtId: "nura" };
  assert.throws(() => confirmEvent(replacement("M1", "esil", noSchool), catalog), hasCode("EVENT_NOT_APPLICABLE"));
});

test("confirm rejects cancelled, unknown, duplicate or incorrectly targeted replacements", () => {
  rejectsReplacement(replacement("M7"), "ACTION_UNAVAILABLE");
  rejectsReplacement(replacement("unknown"), "UNKNOWN_ACTION");
  rejectsReplacement(replacement("M8"), "DUPLICATE_ACTION");
  const missingDistrict = replacement();
  delete missingDistrict.addedDistrictId;
  rejectsReplacement(missingDistrict, "DISTRICT_REQUIRED");
  rejectsReplacement(replacement("M9", "missing"), "UNKNOWN_DISTRICT");
  rejectsReplacement(replacement("M2", "nura"), "DISTRICT_NOT_ALLOWED");
  const custom = structuredClone(catalog);
  custom.actions.push({ ...custom.actions[0], id: "M15" });
  rejectsReplacement(replacement("M15"), "REPLACEMENT_NOT_ALLOWED", custom);
});

test("confirm rechecks local/global conflicts, direction limits and dependencies", () => {
  rejectsReplacement(replacement("M13", "saryarka"), "ACTIONS_INCOMPATIBLE");
  const basePlan = (selections) => ({ modelVersion: "organizer-v1", selections });
  const transport = basePlan([{ actionId: "M7", districtId: "nura" }, { actionId: "M1", districtId: "esil" },
    { actionId: "M10", districtId: "nura" }, { actionId: "M12" }, { actionId: "M9", districtId: "nura" }]);
  rejectsReplacement(replacement("M3", "almaty", transport), "ACTIONS_INCOMPATIBLE");
  const ecology = basePlan([{ actionId: "M7", districtId: "nura" }, { actionId: "M4", districtId: "esil" },
    { actionId: "M5", districtId: "saryarka" }, { actionId: "M10", districtId: "nura" }, { actionId: "M12" }]);
  const thirdEcology = replacement("M6", "nura", ecology);
  delete thirdEcology.addedDistrictId;
  rejectsReplacement(thirdEcology, "DIRECTION_LIMIT_EXCEEDED");
  const retainedRequiresSchool = structuredClone(catalog);
  retainedRequiresSchool.actions.find((action) => action.id === "M8").constraints.requires = ["M7"];
  rejectsReplacement(replacement(), "REQUIREMENT_MISSING", retainedRequiresSchool);
  const newRequiresMissing = structuredClone(catalog);
  newRequiresMissing.actions.find((action) => action.id === "M9").constraints.requires = ["M1"];
  rejectsReplacement(replacement(), "REQUIREMENT_MISSING", newRequiresMissing);
  newRequiresMissing.actions.find((action) => action.id === "M9").constraints.requires = ["M12"];
  assert.equal(confirmEvent(replacement(), newRequiresMissing).branch.valid, true);
});

test("confirmation uses current catalog prices, effects and constraints instead of cached previews", () => {
  const old = previewEvent(request(), catalog);
  const current = structuredClone(catalog);
  current.actions.find((action) => action.id === "M7").cost = 20;
  current.actions.find((action) => action.id === "M9").cost = 29;
  const refreshed = previewEvent(request(), current);
  assert.equal(refreshed.base.remainingBudget, 9);
  assert.equal(refreshed.refundAmount, 20);
  assert.equal(refreshed.availableBudget, 29);
  assert.equal(confirmEvent(replacement(), current).branch.totalCost, 100);
  current.actions.find((action) => action.id === "M9").cost = 30;
  rejectsReplacement({ ...replacement(), result: old.replacementOptions[0].result, cost: 0, effects: { S1: 100 } }, "BUDGET_EXCEEDED", current);
  current.actions.find((action) => action.id === "M9").cost = 10;
  current.actions.find((action) => action.id === "M9").effects = {};
  const rechecked = confirmEvent(replacement(), current);
  assert.notEqual(rechecked.branch.officialScore, old.replacementOptions[0].result.officialScore);
  assert.deepEqual(rechecked.branch, simulatePlan(rechecked.branch.plan, current));
  current.actions.find((action) => action.id === "M5").cost = 100;
  assert.throws(() => confirmEvent(replacement(), current), hasCode("INVALID_BASE_PLAN"));
});

test("zero, one or two feasible measures are returned without padding recommendations", () => {
  for (const allowed of [[], ["M9"], ["M9", "M14"]]) {
    const custom = structuredClone(catalog);
    const selected = new Set(custom.demoPlan.selections.map((item) => item.actionId));
    for (const action of custom.actions) if (!selected.has(action.id) && !allowed.includes(action.id)) action.cost = 101;
    const result = previewEvent(request(), custom);
    assert.equal(result.replacementOptions.length, allowed.length);
    assert.deepEqual(result.replacementOptions.map((option) => option.addedActionId).sort(), [...allowed].sort());
  }
});

test("equal Score recommendations use lower cost, then lexical action and district IDs", () => {
  const custom = structuredClone(catalog);
  custom.synergies = [];
  for (const action of custom.actions) action.effects = {};
  const options = previewEvent(request(), custom).replacementOptions;
  assert.deepEqual(options.map((option) => option.addedActionId), ["M11", "M9", "M4"]);
  assert.deepEqual(options.map((option) => option.addedSelection.districtId), ["almaty", "almaty", "almaty"]);
  for (const option of options) close(option.comparison.scoreDelta, 0);
  custom.actions.reverse();
  assert.deepEqual(previewEvent(request(), custom).replacementOptions, options);
});

test("all action/district choices agree with full-plan validation, including non-recommended choices", () => {
  const preview = previewEvent(request(), catalog);
  const valid = [];
  for (const action of catalog.actions) {
    if (action.id === "M7") continue;
    const targets = action.scope === "city" ? [undefined] : catalog.districts.map((district) => district.id);
    for (const districtId of targets) {
      const added = districtId === undefined ? { actionId: action.id } : { actionId: action.id, districtId };
      const plan = { modelVersion: "organizer-v1", selections: [...preview.draft.selections, added] };
      const expected = simulatePlan(plan, catalog);
      const input = { ...request(), removedActionId: "M7", addedActionId: action.id,
        ...(districtId === undefined ? {} : { addedDistrictId: districtId }) };
      if (expected.valid) {
        assert.deepEqual(confirmEvent(input, catalog).branch, expected);
        valid.push({ added, result: expected });
      } else {
        assert.throws(() => confirmEvent(input, catalog), hasCode("INVALID_REPLACEMENT"));
      }
    }
  }
  const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  valid.sort((a, b) => b.result.officialScore - a.result.officialScore || a.result.totalCost - b.result.totalCost
    || lexical(a.added.actionId, b.added.actionId) || lexical(a.added.districtId ?? "", b.added.districtId ?? ""));
  const distinct = valid.filter((candidate, index) => valid.findIndex((entry) => entry.added.actionId === candidate.added.actionId) === index);
  assert.deepEqual(preview.replacementOptions.map((option) => option.addedSelection), distinct.slice(0, 3).map((entry) => entry.added));
  assert.ok(valid.some((entry) => !preview.replacementOptions.some((option) => option.addedActionId === entry.added.actionId)));
});

test("confirm accepts frozen inputs and keeps original, branch, input and catalog independent", () => {
  const frozenInput = freeze(replacement());
  const frozenCatalog = freeze(structuredClone(catalog));
  const beforeInput = structuredClone(frozenInput);
  const beforeCatalog = structuredClone(frozenCatalog);
  const first = confirmEvent(frozenInput, frozenCatalog);
  const second = confirmEvent(frozenInput, frozenCatalog);
  assert.deepEqual(first, second);
  first.branch.plan.selections[0].actionId = "tampered";
  first.branch.metrics.districts[0].after.T1 = -999;
  first.event.replacementActionIds.length = 0;
  assert.deepEqual(first.base, second.base);
  assert.deepEqual(confirmEvent(frozenInput, frozenCatalog), second);
  assert.deepEqual(frozenInput, beforeInput);
  assert.deepEqual(frozenCatalog, beforeCatalog);
});
