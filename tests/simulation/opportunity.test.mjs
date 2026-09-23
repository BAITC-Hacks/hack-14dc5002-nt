import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DomainError, simulatePlan } from "../../src/lib/simulation/index.ts";
import { previewEvent, confirmEvent } from "../../src/lib/simulation/events.ts";
import { REQUIRED_ACTION_EVENT } from "../../src/data/team-events.ts";

const catalog = JSON.parse(await readFile(new URL("../../src/data/catalog.json", import.meta.url), "utf8"));
const request = (requiredActionId, basePlan = catalog.demoPlan) => ({
  basePlan, eventId: REQUIRED_ACTION_EVENT.id, eventVersion: REQUIRED_ACTION_EVENT.version, requiredActionId,
});
const confirmInput = (input, removedActionId, districtId) => ({
  ...input, removedActionId, addedActionId: input.requiredActionId,
  ...(districtId === undefined ? {} : { addedDistrictId: districtId }),
});
const hasCode = (code) => (error) => error instanceof DomainError && error.code === code;
const hasIssue = (code) => (error) => hasCode("INVALID_REPLACEMENT")(error) && error.issues.some((issue) => issue.code === code);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} differs from ${expected}`);
const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;

for (const required of catalog.actions) {
  test(`mandatory ${required.id} (${required.scope}) is already present or replaces exactly one selected action`, () => {
    const input = request(required.id);
    const base = simulatePlan(input.basePlan, catalog);
    const preview = previewEvent(input, catalog);
    assert.deepEqual(preview.base, base);
    assert.equal(preview.event.kind, "opportunity");
    assert.equal(preview.event.requiredActionId, required.id);
    assert.equal(preview.event.modelVersion, catalog.config.modelVersion);
    assert.equal("draft" in preview, false);
    if (base.plan.selections.some((selection) => selection.actionId === required.id)) {
      assert.equal(preview.status, "already-satisfied");
      assert.equal(preview.requiresReplacement, false);
      assert.deepEqual(preview.replacementOptions, []);
      assert.throws(() => confirmEvent(confirmInput(input, "M5"), catalog), hasCode("EVENT_ALREADY_SATISFIED"));
      return;
    }
    assert.equal(preview.status, "replacement-required");
    assert.equal(preview.requiresReplacement, true);
    assert.ok(preview.replacementOptions.length > 0 && preview.replacementOptions.length <= 3);
    assert.equal(new Set(preview.replacementOptions.map((option) => option.removedActionId)).size, preview.replacementOptions.length);
    const valid = [];
    for (const removed of base.plan.selections) {
      const retained = base.plan.selections.filter((selection) => selection.actionId !== removed.actionId);
      const targets = required.scope === "city" ? [undefined] : catalog.districts.map((district) => district.id);
      for (const target of targets) {
        const added = target === undefined ? { actionId: required.id } : { actionId: required.id, districtId: target };
        const fullPlan = { modelVersion: input.basePlan.modelVersion, selections: [...retained, added] };
        const expected = simulatePlan(fullPlan, catalog);
        const confirmation = confirmInput(input, removed.actionId, target);
        if (!expected.valid) {
          assert.throws(() => confirmEvent(confirmation, catalog), hasCode("INVALID_REPLACEMENT"));
          continue;
        }
        const confirmed = confirmEvent(confirmation, catalog);
        assert.deepEqual(confirmed.branch, expected);
        assert.deepEqual(confirmed.base, base);
        assert.equal(confirmed.branch.plan.selections.length, 5);
        assert.equal(confirmed.branch.plan.selections.filter((selection) => selection.actionId === required.id).length, 1);
        assert.deepEqual(confirmed.branch.plan.selections.filter((selection) => selection.actionId !== required.id), retained);
        valid.push({ removedActionId: removed.actionId, added, result: expected });
      }
    }
    valid.sort((a, b) => b.result.officialScore - a.result.officialScore || a.result.totalCost - b.result.totalCost
      || lexical(a.removedActionId, b.removedActionId) || lexical(a.added.districtId ?? "", b.added.districtId ?? ""));
    const distinct = valid.filter((entry, index) => valid.findIndex((candidate) => candidate.removedActionId === entry.removedActionId) === index);
    assert.deepEqual(preview.replacementOptions.map((option) => [option.removedActionId, option.addedSelection]),
      distinct.slice(0, 3).map((entry) => [entry.removedActionId, entry.added]));
    for (const option of preview.replacementOptions) {
      assert.equal(option.addedActionId, required.id);
      const refund = catalog.actions.find((action) => action.id === option.removedActionId).cost;
      assert.equal(option.refundAmount, refund);
      close(option.availableBudget, base.remainingBudget + refund);
      close(option.result.totalCost, base.totalCost - refund + required.cost);
      close(option.comparison.scoreDelta, option.result.officialScore - base.officialScore);
      const confirmed = confirmEvent(confirmInput(input, option.removedActionId, option.addedSelection.districtId), catalog);
      assert.deepEqual(confirmed.branch, option.result);
      assert.deepEqual(confirmed.comparison, option.comparison);
    }
  });
}

test("mandatory M14 demo has three different removals with reproducible scores", () => {
  const preview = previewEvent(request("M14"), catalog);
  assert.deepEqual(preview.replacementOptions.map((option) => option.removedActionId), ["M5", "M12", "M10"]);
  assert.deepEqual(preview.replacementOptions.map((option) => option.result.totalCost), [86, 97, 99]);
  for (const [index, score] of [56.98582, 56.64391, 56.62718].entries()) close(preview.replacementOptions[index].result.officialScore, score);
  const retainedSynergy = confirmEvent(confirmInput(request("M14"), "M5"), catalog);
  assert.deepEqual(retainedSynergy.branch.metrics.synergiesApplied.map((entry) => entry.actionIds), [["M10", "M12"]]);
  const removedSynergy = confirmEvent(confirmInput(request("M14"), "M12"), catalog);
  assert.deepEqual(removedSynergy.branch.metrics.synergiesApplied, []);
});

test("mandatory action cannot replace an unselected ID or be substituted with a different action", () => {
  const input = confirmInput(request("M14"), "M5");
  assert.throws(() => confirmEvent({ ...input, removedActionId: "M2" }, catalog), hasCode("INVALID_REMOVAL"));
  assert.throws(() => confirmEvent({ ...input, removedActionId: "unknown" }, catalog), hasCode("INVALID_REMOVAL"));
  assert.throws(() => confirmEvent({ ...input, addedActionId: "M2" }, catalog), hasCode("REQUIRED_ACTION_MISMATCH"));
  assert.throws(() => confirmEvent({ ...input, addedDistrictId: "nura" }, catalog), hasIssue("DISTRICT_NOT_ALLOWED"));
  assert.throws(() => confirmEvent(confirmInput(request("M9"), "M7"), catalog), hasIssue("DISTRICT_REQUIRED"));
  assert.throws(() => confirmEvent(confirmInput(request("M9"), "M7", "unknown"), catalog), hasIssue("UNKNOWN_DISTRICT"));
});

test("mandatory action budget produces zero, one, two or three options without padding", () => {
  for (const [price, count] of [[31, 0], [30, 1], [29, 2], [16, 3]]) {
    const custom = structuredClone(catalog);
    custom.actions.find((action) => action.id === "M14").cost = price;
    const preview = previewEvent(request("M14"), custom);
    assert.equal(preview.status, count === 0 ? "no-valid-replacement" : "replacement-required");
    assert.equal(preview.requiresReplacement, true);
    assert.equal(preview.replacementOptions.length, count);
    assert.equal(preview.base.officialScore, simulatePlan(catalog.demoPlan, custom).officialScore);
    if (count === 0) {
      for (const removed of catalog.demoPlan.selections) {
        assert.throws(() => confirmEvent(confirmInput(request("M14"), removed.actionId), custom), hasIssue("BUDGET_EXCEEDED"));
      }
    }
  }
});

test("opportunity rejects malformed inputs, unknown targets, stale versions and mixed event kinds", () => {
  for (const input of [null, {}, ...[undefined, null, "", "  ", 14, {}, []].map((id) => request(id))]) {
    assert.throws(() => previewEvent(input, catalog), hasCode("INVALID_EVENT_INPUT"));
  }
  assert.throws(() => previewEvent(request("unknown"), catalog), hasCode("UNKNOWN_ACTION"));
  assert.throws(() => previewEvent({ ...request("M14"), eventVersion: "old" }, catalog), hasCode("EVENT_VERSION_MISMATCH"));
  assert.throws(() => previewEvent({ ...request("M14"), eventId: "unknown" }, catalog), hasCode("UNKNOWN_EVENT"));
  assert.throws(() => previewEvent({ ...request("M14"), cancelledActionId: "M7" }, catalog), hasCode("INVALID_EVENT_INPUT"));
  assert.throws(() => previewEvent({ ...request("M14"), eventId: "cancel-action", eventVersion: "team-events-v2", cancelledActionId: "M7" }, catalog), hasCode("INVALID_EVENT_INPUT"));
  for (const input of [null, {}, { ...confirmInput(request("M14"), "M5"), addedActionId: 14 },
    { ...confirmInput(request("M14"), "M5"), addedDistrictId: null }, { ...confirmInput(request("M14"), "M5"), removedActionId: "" }]) {
    assert.throws(() => confirmEvent(input, catalog), hasCode("INVALID_REPLACEMENT_INPUT"));
  }
  assert.throws(() => confirmEvent(confirmInput(request(undefined), "M5"), catalog), hasCode("INVALID_REPLACEMENT_INPUT"));
  assert.throws(() => confirmEvent({ ...confirmInput(request("M14"), "M5"), requiredActionId: undefined }, catalog), hasCode("INVALID_EVENT_INPUT"));
});

test("even an already-selected mandatory action requires a valid original five and valid catalog", () => {
  const plan = catalog.demoPlan;
  for (const basePlan of [null, {}, { ...plan, selections: plan.selections.slice(1) },
    { ...plan, selections: [...plan.selections, { actionId: "M14" }] },
    { ...plan, selections: [plan.selections[0], ...plan.selections.slice(0, 4)] },
    { ...plan, modelVersion: "wrong" }]) {
    assert.throws(() => previewEvent(request("M12", basePlan), catalog), hasCode("INVALID_BASE_PLAN"));
  }
  for (const corrupt of [
    (c) => { c.actions.find((action) => action.id === "M14").effects = null; },
    (c) => { c.actions.find((action) => action.id === "M14").cost = Number.NaN; },
    (c) => { c.actions.find((action) => action.id === "M14").lagQuarters = undefined; },
    (c) => { c.actions.find((action) => action.id === "M14").constraints = undefined; },
  ]) {
    const custom = structuredClone(catalog);
    corrupt(custom);
    assert.throws(() => previewEvent(request("M14"), custom),
      (error) => hasCode("INVALID_BASE_PLAN")(error) && error.issues.some((issue) => issue.code === "INVALID_CATALOG"));
  }
});

test("global/local conflicts and direction limits determine which old action may be removed", () => {
  const basePlan = { modelVersion: catalog.config.modelVersion, selections: [
    { actionId: "M1", districtId: "esil" }, { actionId: "M7", districtId: "nura" },
    { actionId: "M9", districtId: "nura" }, { actionId: "M10", districtId: "nura" }, { actionId: "M12" },
  ] };
  const preview = previewEvent(request("M3", basePlan), catalog);
  assert.equal(preview.replacementOptions.length, 1);
  assert.equal(preview.replacementOptions[0].removedActionId, "M1");
  assert.throws(() => confirmEvent(confirmInput(request("M3", basePlan), "M7", "nura"), catalog), hasIssue("ACTIONS_INCOMPATIBLE"));
  assert.throws(() => confirmEvent(confirmInput(request("M4"), "M5", "nura"), catalog), hasIssue("ACTIONS_INCOMPATIBLE"));
  assert.equal(confirmEvent(confirmInput(request("M4"), "M5", "esil"), catalog).branch.valid, true);
  assert.throws(() => confirmEvent(confirmInput(request("M9"), "M5", "nura"), catalog), hasIssue("DIRECTION_LIMIT_EXCEEDED"));
  assert.equal(confirmEvent(confirmInput(request("M9"), "M7", "nura"), catalog).branch.valid, true);
});

test("required and retained dependencies are revalidated without adding extra actions", () => {
  const custom = structuredClone(catalog);
  custom.actions.find((action) => action.id === "M14").constraints.requires = ["M12"];
  const preview = previewEvent(request("M14"), custom);
  assert.equal(preview.replacementOptions.some((option) => option.removedActionId === "M12"), false);
  assert.throws(() => confirmEvent(confirmInput(request("M14"), "M12"), custom), hasIssue("REQUIREMENT_MISSING"));
  custom.actions.find((action) => action.id === "M10").constraints.requires = ["M5"];
  assert.throws(() => confirmEvent(confirmInput(request("M14"), "M5"), custom), hasIssue("REQUIREMENT_MISSING"));
  custom.actions.find((action) => action.id === "M14").constraints.requires = ["M1", "M2"];
  const blocked = previewEvent(request("M14"), custom);
  assert.equal(blocked.status, "no-valid-replacement");
  assert.deepEqual(blocked.replacementOptions, []);
  assert.equal(blocked.base.plan.selections.length, 5);
  assert.deepEqual(blocked.base.plan, simulatePlan(catalog.demoPlan, custom).plan);
});

test("confirm uses current catalog prices and effects, not a previously recommended result", () => {
  const input = confirmInput(request("M14"), "M5");
  const old = confirmEvent(input, catalog);
  const custom = structuredClone(catalog);
  const required = custom.actions.find((action) => action.id === "M14");
  required.cost = 30;
  assert.equal(confirmEvent(input, custom).branch.totalCost, 100);
  required.cost = 31;
  assert.throws(() => confirmEvent({ ...input, result: old.branch, cost: 0, availableBudget: 100 }, custom), hasIssue("BUDGET_EXCEEDED"));
  required.cost = 16;
  required.effects = { C1: -5, C2: -2 };
  const updated = confirmEvent(input, custom);
  assert.notEqual(updated.branch.officialScore, old.branch.officialScore);
  assert.deepEqual(updated.branch, simulatePlan(updated.branch.plan, custom));
  assert.ok(updated.branch.trace.find((entry) => entry.actionId === "M14").appliedEffects.C1 < 0);
  for (const option of previewEvent(request("M14"), custom).replacementOptions) assert.ok(option.comparison.scoreDelta < 0);
  required.lagQuarters = 8;
  assert.deepEqual(confirmEvent(input, custom).branch.trace.find((entry) => entry.actionId === "M14").appliedEffects, {});
  required.lagQuarters = 0;
  assert.equal(confirmEvent(input, custom).branch.trace.find((entry) => entry.actionId === "M14").appliedEffects.C1, -5);
  custom.actions.find((action) => action.id === "M5").cost = 100;
  assert.throws(() => confirmEvent(input, custom), hasCode("INVALID_BASE_PLAN"));
});

test("recent catalog additions work by ID with an explicit matching model version", () => {
  const custom = structuredClone(catalog);
  custom.config.modelVersion = "organizer-fixture-v2";
  custom.actions.push({ ...structuredClone(custom.actions.find((action) => action.id === "M14")), id: "new-catalog-id" });
  // Only a test copy is extended; the production catalog and input version are not rewritten.
  assert.throws(() => previewEvent(request("new-catalog-id"), custom), hasCode("INVALID_BASE_PLAN"));
  const basePlan = { ...catalog.demoPlan, modelVersion: custom.config.modelVersion };
  const input = request("new-catalog-id", basePlan);
  const preview = previewEvent(input, custom);
  assert.equal(preview.event.modelVersion, "organizer-fixture-v2");
  assert.equal(preview.status, "replacement-required");
  assert.ok(preview.replacementOptions.every((option) => option.addedActionId === "new-catalog-id"));
  close(preview.base.officialScore, simulatePlan(catalog.demoPlan, catalog).officialScore);
  const confirmed = confirmEvent(confirmInput(input, "M5"), custom);
  assert.equal(confirmed.branch.valid, true);
  custom.actions = custom.actions.filter((action) => action.id !== "new-catalog-id");
  assert.throws(() => confirmEvent(confirmInput(input, "M5"), custom), hasCode("UNKNOWN_ACTION"));
});

test("equal-score opportunity recommendations use cost then removal ID and district ID", () => {
  const custom = structuredClone(catalog);
  custom.synergies = [];
  for (const action of custom.actions) { action.effects = {}; action.cost = 10; }
  const first = previewEvent(request("M1"), custom);
  assert.deepEqual(first.replacementOptions.map((option) => option.removedActionId), ["M10", "M12", "M5"]);
  assert.deepEqual(first.replacementOptions.map((option) => option.addedSelection.districtId), ["almaty", "almaty", "almaty"]);
  custom.actions.reverse();
  assert.deepEqual(previewEvent(request("M1", { ...catalog.demoPlan, selections: [...catalog.demoPlan.selections].reverse() }), custom), first);
  custom.districts.reverse();
  assert.deepEqual(previewEvent(request("M1"), custom).replacementOptions.map((option) => [option.removedActionId, option.addedSelection]),
    first.replacementOptions.map((option) => [option.removedActionId, option.addedSelection]));
});

test("opportunity results and inputs remain independent and deterministic with frozen data", () => {
  const freeze = (value) => {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const immutableCatalog = freeze(structuredClone(catalog));
  const input = freeze(request("M13", structuredClone(catalog.demoPlan)));
  const savedInput = structuredClone(input);
  const savedCatalog = structuredClone(immutableCatalog);
  const preview = previewEvent(input, immutableCatalog);
  const snapshot = structuredClone(preview);
  const option = preview.replacementOptions[0];
  const confirmation = freeze(confirmInput(input, option.removedActionId, option.addedSelection.districtId));
  const confirmed = confirmEvent(confirmation, immutableCatalog);
  const savedConfirmed = structuredClone(confirmed);
  preview.event.requiredActionId = "tampered";
  preview.replacementOptions[0].plan.selections[0].actionId = "tampered";
  assert.deepEqual(preview.replacementOptions[0].result, snapshot.replacementOptions[0].result);
  preview.replacementOptions[0].result.metrics.districts[0].after.C1 = -999;
  confirmed.branch.plan.selections[0].actionId = "tampered";
  confirmed.branch.metrics.districts[0].after.C1 = -999;
  confirmed.event.requiredActionId = "tampered";
  assert.deepEqual(preview.base, snapshot.base);
  assert.deepEqual(confirmed.base, savedConfirmed.base);
  assert.deepEqual(previewEvent(input, immutableCatalog), snapshot);
  assert.deepEqual(confirmEvent(confirmation, immutableCatalog), savedConfirmed);
  assert.deepEqual(input, savedInput);
  assert.deepEqual(immutableCatalog, savedCatalog);
});
