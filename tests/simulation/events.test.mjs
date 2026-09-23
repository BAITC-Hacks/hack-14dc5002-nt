import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DomainError, simulatePlan } from "../../src/lib/simulation/index.ts";
import { previewEvent } from "../../src/lib/simulation/events.ts";
import { SCHOOL_CANCELLATION_EVENT } from "../../src/data/team-events.ts";

const catalog = JSON.parse(await readFile(new URL("../../src/data/catalog.json", import.meta.url), "utf8"));
const request = (basePlan = catalog.demoPlan) => ({ basePlan, eventId: "cancel-m7", eventVersion: "team-events-v1" });
const hasCode = (code) => (error) => error instanceof DomainError && error.code === code;
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
