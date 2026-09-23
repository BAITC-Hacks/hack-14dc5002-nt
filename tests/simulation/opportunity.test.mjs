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
