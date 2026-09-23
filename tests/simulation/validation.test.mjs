import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePlan, simulatePlan } from "../../src/lib/simulation/index.ts";

const catalog = JSON.parse(await readFile(new URL("../../src/data/organizer-catalog.json", import.meta.url), "utf8"));

test("duplicate selections do not cause a spurious budget error", () => {
  const plan = {
    modelVersion: catalog.config.modelVersion,
    selections: [...Array.from({ length: 4 }, () => ({ actionId: "M5", districtId: "saryarka" })), { actionId: "M12" }],
  };
  const result = simulatePlan(plan, catalog);
  assert.equal(result.valid, false);
  assert.equal(result.totalCost, 39);
  assert.equal(result.remainingBudget, 61);
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_ACTION"));
  assert.ok(!result.errors.some((error) => error.code === "BUDGET_EXCEEDED"));
});

test("malformed plan values return invalid results rather than crashing", () => {
  const malformed = [null, {}, { selections: "M7" },
    { modelVersion: "organizer-v1", selections: [null] },
    { modelVersion: "organizer-v1", selections: [{ actionId: 7 }] },
    { modelVersion: "organizer-v1", selections: [{ actionId: "M7", districtId: {} }] },
  ];
  for (const plan of malformed) {
    assert.ok(validatePlan(plan, catalog).some((error) => error.code === "INVALID_PLAN"));
    const result = simulatePlan(plan, catalog);
    assert.equal(result.valid, false);
    assert.equal(result.officialScore, null);
    assert.equal(result.metrics, null);
    assert.deepEqual(result.trace, []);
    assert.ok(Number.isFinite(result.totalCost));
  }
});

test("corrupt catalog structures and invalid relation targets are rejected before scoring", () => {
  const corruptions = [
    (c) => { c.actions[0] = null; },
    (c) => { c.actions[0].constraints = undefined; },
    (c) => { c.actions[0].effects = null; },
    (c) => { c.districts[0] = null; },
    (c) => { c.conflicts[0].scope = "unknown"; },
    (c) => { c.conflicts[0].actionIds = ["M1", "M1"]; },
    (c) => { c.synergies[1].districtActionId = "M12"; },
    (c) => { c.synergies[1].districtActionId = "M7"; },
    (c) => { c.synergies[0].actionIds = ["M1"]; },
  ];
  for (const corrupt of corruptions) {
    const c = structuredClone(catalog);
    corrupt(c);
    assert.ok(validatePlan(catalog.demoPlan, c).some((error) => error.code === "INVALID_CATALOG"));
    const result = simulatePlan(catalog.demoPlan, c);
    assert.equal(result.valid, false);
    assert.equal(result.officialScore, null);
    assert.equal(result.metrics, null);
  }
});
