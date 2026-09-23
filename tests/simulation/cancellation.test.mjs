import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DomainError, simulatePlan } from "../../src/lib/simulation/index.ts";
import { previewEvent, confirmEvent } from "../../src/lib/simulation/events.ts";
import { ACTION_CANCELLATION_EVENT } from "../../src/data/team-events.ts";

const catalog = JSON.parse(await readFile(new URL("../../src/data/organizer-catalog.json", import.meta.url), "utf8"));
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
const hasCode = (code) => (error) => error instanceof DomainError && error.code === code;
const hasIssue = (code) => (error) => hasCode("INVALID_REPLACEMENT")(error) && error.issues.some((issue) => issue.code === code);
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

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
    // Exhaustive independent full-plan oracle, not only the recommended replacements.
    const valid = [];
    for (const candidate of catalog.actions) {
      if (candidate.id === action.id) continue;
      const targets = candidate.scope === "city" ? [undefined] : catalog.districts.map((district) => district.id);
      for (const target of targets) {
        const added = selection(candidate.id, target);
        const expected = simulatePlan(plan(...retained, added), catalog);
        const confirmedInput = confirmation(input, added);
        if (expected.valid) {
          assert.deepEqual(confirmEvent(confirmedInput, catalog).branch, expected);
          valid.push({ added, result: expected });
        } else {
          assert.throws(() => confirmEvent(confirmedInput, catalog), hasCode("INVALID_REPLACEMENT"));
        }
      }
    }
    const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    valid.sort((a, b) => b.result.officialScore - a.result.officialScore || a.result.totalCost - b.result.totalCost
      || lexical(a.added.actionId, b.added.actionId) || lexical(a.added.districtId ?? "", b.added.districtId ?? ""));
    const distinct = valid.filter((entry, index) => valid.findIndex((candidate) => candidate.added.actionId === entry.added.actionId) === index);
    assert.deepEqual(preview.replacementOptions.map((option) => option.addedSelection), distinct.slice(0, 3).map((entry) => entry.added));
    assert.throws(() => confirmEvent(confirmation(input, basePlan.selections.find((item) => item.actionId === action.id)), catalog), hasIssue("ACTION_UNAVAILABLE"));
    assert.deepEqual(simulatePlan(basePlan, catalog), original);
  });
}

test("general cancellation requires an explicit selected target and matching event version", () => {
  for (const id of [undefined, null, "", "  ", 7, {}, []]) {
    assert.throws(() => previewEvent(request(id), catalog), hasCode("INVALID_EVENT_INPUT"));
    assert.throws(() => confirmEvent({ ...confirmation(request(id), selection("M14")), removedActionId: "M12" }, catalog), hasCode("INVALID_EVENT_INPUT"));
  }
  for (const id of ["M1", "unknown"]) assert.throws(() => previewEvent(request(id), catalog), hasCode("EVENT_NOT_APPLICABLE"));
  assert.throws(() => previewEvent({ ...request("M12"), eventVersion: "team-events-v1" }, catalog), hasCode("EVENT_VERSION_MISMATCH"));
  assert.throws(() => previewEvent({ ...request("M12"), eventId: "unknown" }, catalog), hasCode("UNKNOWN_EVENT"));
  for (const basePlan of [null, plan(...catalog.demoPlan.selections.slice(1)), plan(...catalog.demoPlan.selections, selection("M14"))]) {
    assert.throws(() => previewEvent(request("M12", basePlan), catalog), hasCode("INVALID_BASE_PLAN"));
  }
});

test("confirmation cannot remove a different measure or add the cancelled measure back", () => {
  const input = confirmation(request("M12"), selection("M14"));
  assert.throws(() => confirmEvent({ ...input, removedActionId: "M10" }, catalog), hasCode("INVALID_REMOVAL"));
  assert.throws(() => confirmEvent({ ...input, addedActionId: "M12" }, catalog), hasIssue("ACTION_UNAVAILABLE"));
  assert.throws(() => confirmEvent({ ...input, addedActionId: "missing" }, catalog), hasIssue("UNKNOWN_ACTION"));
  assert.throws(() => confirmEvent({ ...input, addedDistrictId: "nura" }, catalog), hasIssue("DISTRICT_NOT_ALLOWED"));
  assert.throws(() => confirmEvent({ ...input, addedActionId: "M9" }, catalog), hasIssue("DISTRICT_REQUIRED"));
});

test("cancelling a city measure removes its effects from every district and removes its synergy", () => {
  const result = confirmEvent(confirmation(request("M12"), selection("M14")), catalog);
  assert.equal(result.branch.totalCost, 97);
  assert.deepEqual(result.base.metrics.synergiesApplied.map((synergy) => synergy.actionIds), [["M10", "M12"]]);
  assert.deepEqual(result.branch.metrics.synergiesApplied, []);
  for (const district of result.comparison.districts) {
    close(district.indicatorsDelta.C2, -2.625); // M12: +4.375 -> M14: +1.75.
    close(district.indicatorsDelta.C1, 4.375);
    close(district.indicatorsDelta.B1, district.districtId === "nura" ? -2 : 0);
  }
});

test("cancellation removes negative effects and unlocks formerly incompatible measures", () => {
  const base = portfolios[1];
  const withoutNegative = confirmEvent(confirmation(request("M11", base), selection("M10", "nura")), catalog);
  close(withoutNegative.comparison.districts.find((district) => district.districtId === "nura").indicatorsDelta.T1, 1.75);
  assert.deepEqual(withoutNegative.branch.metrics.synergiesApplied.map((synergy) => synergy.actionIds), [["M1", "M2"]]);
  const withLrt = confirmEvent(confirmation(request("M1", base), selection("M3", "nura")), catalog);
  assert.equal(withLrt.branch.valid, true);
  assert.deepEqual(withLrt.branch.metrics.synergiesApplied, []);
  // M7 is a normal candidate when a different measure is cancelled.
  const withSchool = confirmEvent(confirmation(request("M4", base), selection("M7", "esil")), catalog);
  assert.equal(withSchool.branch.totalCost, 84);
  assert.equal(withSchool.branch.valid, true);
});

test("a retained dependency on the cancelled measure yields no one-step replacement", () => {
  const custom = structuredClone(catalog);
  custom.actions.find((action) => action.id === "M10").constraints.requires = ["M12"];
  const preview = previewEvent(request("M12"), custom);
  assert.equal(preview.base.valid, true);
  assert.deepEqual(preview.replacementOptions, []);
  assert.equal(preview.draftResult.officialScore, null);
  assert.ok(preview.draftResult.errors.some((issue) => issue.code === "REQUIREMENT_MISSING"));
  assert.throws(() => confirmEvent(confirmation(request("M12"), selection("M14")), custom), hasIssue("REQUIREMENT_MISSING"));
});

test("general confirmation rechecks catalog prices, effects and base-plan validity", () => {
  const input = confirmation(request("M12"), selection("M14"));
  const previous = confirmEvent(input, catalog);
  const custom = structuredClone(catalog);
  custom.actions.find((action) => action.id === "M12").cost = 12;
  const preview = previewEvent(request("M12"), custom);
  assert.equal(preview.base.remainingBudget, 7);
  assert.equal(preview.refundAmount, 12);
  assert.equal(preview.availableBudget, 19);
  custom.actions.find((action) => action.id === "M14").cost = 19;
  assert.equal(confirmEvent(input, custom).branch.totalCost, 100);
  custom.actions.find((action) => action.id === "M14").cost = 20;
  assert.throws(() => confirmEvent({ ...input, result: previous.branch, cost: 0, refundAmount: 100 }, custom), hasIssue("BUDGET_EXCEEDED"));
  custom.actions.find((action) => action.id === "M14").cost = 16;
  custom.actions.find((action) => action.id === "M14").effects = {};
  const refreshed = confirmEvent(input, custom);
  assert.notEqual(refreshed.branch.officialScore, previous.branch.officialScore);
  assert.deepEqual(refreshed.branch, simulatePlan(refreshed.branch.plan, custom));
  custom.actions.find((action) => action.id === "M5").cost = 100;
  assert.throws(() => confirmEvent(input, custom), hasCode("INVALID_BASE_PLAN"));
});

test("general cancellation derives targets and replacements from catalog IDs, not a hard-coded whitelist", () => {
  const custom = structuredClone(catalog);
  custom.actions.push({ ...structuredClone(custom.actions.find((action) => action.id === "M14")), id: "catalog-extra" });
  const input = request("M12");
  const preview = previewEvent(input, custom);
  assert.ok(preview.event.replacementActionIds.includes("catalog-extra"));
  const confirmed = confirmEvent(confirmation(input, selection("catalog-extra")), custom);
  assert.equal(confirmed.branch.valid, true);
  const nextPreview = previewEvent(request("catalog-extra", confirmed.branch.plan), custom);
  assert.equal(nextPreview.refundAmount, 16);
  assert.equal(nextPreview.event.replacementActionIds.includes("catalog-extra"), false);
});

test("general cancellation is deterministic, non-mutating and returns isolated results", () => {
  const immutableCatalog = freeze(structuredClone(catalog));
  const input = freeze(request("M12", structuredClone(catalog.demoPlan)));
  const savedCatalog = structuredClone(immutableCatalog);
  const savedInput = structuredClone(input);
  const preview = previewEvent(input, immutableCatalog);
  const snapshot = structuredClone(preview);
  const reordered = structuredClone(catalog);
  reordered.actions.reverse();
  const reversedInput = { ...input, basePlan: { ...input.basePlan, selections: [...input.basePlan.selections].reverse() } };
  assert.deepEqual(previewEvent(reversedInput, reordered), snapshot);
  const confirmedInput = freeze(confirmation(input, preview.replacementOptions[0].addedSelection));
  const confirmed = confirmEvent(confirmedInput, immutableCatalog);
  const savedConfirmed = structuredClone(confirmed);
  preview.draft.selections[0].actionId = "mutated";
  preview.replacementOptions[0].result.metrics.districts[0].after.T1 = -999;
  preview.event.replacementActionIds.length = 0;
  confirmed.branch.plan.selections[0].actionId = "mutated";
  confirmed.branch.metrics.districts[0].after.T1 = -999;
  confirmed.event.replacementActionIds.length = 0;
  assert.deepEqual(preview.base, snapshot.base);
  assert.deepEqual(confirmed.base, savedConfirmed.base);
  assert.deepEqual(previewEvent(input, immutableCatalog), snapshot);
  assert.deepEqual(confirmEvent(confirmedInput, immutableCatalog), savedConfirmed);
  assert.deepEqual(immutableCatalog, savedCatalog);
  assert.deepEqual(input, savedInput);
});

test("legacy school event stays compatible and cannot silently target another action", () => {
  const oldInput = { basePlan: catalog.demoPlan, eventId: "cancel-m7", eventVersion: "team-events-v1" };
  const old = previewEvent(oldInput, catalog);
  const general = previewEvent(request("M7"), catalog);
  for (const field of ["base", "draft", "draftResult", "refundAmount", "availableBudget", "replacementOptions"]) {
    assert.deepEqual(old[field], general[field]);
  }
  assert.deepEqual(previewEvent({ ...oldInput, cancelledActionId: "M7" }, catalog), old);
  assert.throws(() => previewEvent({ ...oldInput, cancelledActionId: "M12" }, catalog), hasCode("INVALID_EVENT_INPUT"));
  const oldConfirm = { ...oldInput, removedActionId: "M7", addedActionId: "M9", addedDistrictId: "nura" };
  assert.deepEqual(confirmEvent(oldConfirm, catalog).branch, confirmEvent(confirmation(request("M7"), selection("M9", "nura")), catalog).branch);
});
