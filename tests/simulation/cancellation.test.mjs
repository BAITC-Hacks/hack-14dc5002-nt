import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { simulatePlan } from "../../src/lib/simulation/index.ts";
import { previewEvent, confirmEvent } from "../../src/lib/simulation/events.ts";
import { ACTION_CANCELLATION_EVENT } from "../../src/data/team-events.ts";

const catalog = JSON.parse(await readFile(new URL("../../src/data/catalog.json", import.meta.url), "utf8"));
const selection = (actionId, districtId) => districtId === undefined ? { actionId } : { actionId, districtId };
const plan = (...selections) => ({ modelVersion: catalog.config.modelVersion, selections });
// Four valid portfolios cover every one of the 14 actions, including all city actions.
const portfolios = [
  catalog.demoPlan,
  plan(selection("M1", "nura"), selection("M2"), selection("M4", "esil"), selection("M9", "nura"), selection("M11", "nura")),
  plan(selection("M3", "nura"), selection("M6"), selection("M13", "esil"), selection("M10", "nura"), selection("M9", "nura")),
  plan(selection("M14"), selection("M4", "esil"), selection("M5", "saryarka"), selection("M11", "nura"), selection("M9", "nura")),
];
const request = (cancelledActionId, basePlan = catalog.demoPlan) => ({
  basePlan, eventId: ACTION_CANCELLATION_EVENT.id, eventVersion: ACTION_CANCELLATION_EVENT.version, cancelledActionId,
});
const confirmation = (input, addedSelection) => ({
  ...input, removedActionId: input.cancelledActionId, addedActionId: addedSelection.actionId,
  ...(addedSelection.districtId === undefined ? {} : { addedDistrictId: addedSelection.districtId }),
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} differs from ${expected}`);

for (const action of catalog.actions) {
  test(`general cancellation supports ${action.id} (${action.scope}) with full-plan replacements`, () => {
    const basePlan = portfolios.find((candidate) => candidate.selections.some((item) => item.actionId === action.id));
    assert.ok(basePlan, `Missing test portfolio for ${action.id}`);
    const original = simulatePlan(basePlan, catalog);
    assert.equal(original.valid, true);
    const input = request(action.id, basePlan);
    const preview = previewEvent(input, catalog);
    assert.deepEqual(preview.base, original);
    assert.equal(preview.event.cancelledActionId, action.id);
    assert.equal(preview.refundAmount, action.cost);
    close(preview.availableBudget, original.remainingBudget + action.cost);
    close(preview.draftResult.totalCost, original.totalCost - action.cost);
    const retained = original.plan.selections.filter((item) => item.actionId !== action.id);
    assert.deepEqual(preview.draft.selections, retained);
    assert.equal(preview.draft.selections.length, 4);
    assert.equal(preview.draftResult.valid, false);
    assert.equal(preview.draftResult.officialScore, null);
    assert.equal(preview.draftResult.metrics, null);
    assert.deepEqual(preview.draftResult.trace, []);
    assert.equal(preview.event.replacementActionIds.includes(action.id), false);
    assert.ok(preview.replacementOptions.length > 0 && preview.replacementOptions.length <= 3);
    for (const option of preview.replacementOptions) {
      assert.equal(option.removedActionId, action.id);
      assert.equal(option.result.valid, true);
      assert.ok(option.result.totalCost <= catalog.config.budgetLimit);
      assert.equal(option.plan.selections.length, 5);
      assert.equal(option.plan.selections.some((item) => item.actionId === action.id), false);
      assert.deepEqual(option.plan.selections.filter((item) => item.actionId !== option.addedActionId), retained);
      assert.deepEqual(option.result, simulatePlan(option.plan, catalog));
      const confirmed = confirmEvent(confirmation(input, option.addedSelection), catalog);
      assert.deepEqual(confirmed.base, original);
      assert.deepEqual(confirmed.branch, option.result);
      assert.deepEqual(confirmed.comparison, option.comparison);
      assert.equal(confirmed.branch.trace.some((entry) => entry.actionId === action.id), false);
      assert.equal(confirmed.branch.metrics.synergiesApplied.some((synergy) => synergy.actionIds.includes(action.id)), false);
    }
    assert.deepEqual(simulatePlan(basePlan, catalog), original);
  });
}
