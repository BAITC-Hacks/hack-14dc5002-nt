/** Offline fixture/math check. This is NOT the application's engine or API. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const load = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await load('src/data/catalog.json');
const dims = Object.keys(catalog.config.dimensionWeights);
const actions = new Map(catalog.actions.map((a) => [a.id, a]));
const events = new Map(catalog.events.map((e) => [e.id, e]));
const districtIds = new Set(catalog.districts.map((d) => d.id));
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
const close = (actual, expected, message) => {
  check(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-6, message);
};
close(catalog.districts.reduce((s, d) => s + d.weight, 0), 1, 'district weights');
close(Object.values(catalog.config.dimensionWeights).reduce((s, v) => s + v, 0), 1, 'dimension weights');
check(actions.size === catalog.actions.length, 'unique action IDs');
check(events.size === catalog.events.length, 'unique event IDs');
for (const a of actions.values()) {
  check(Number.isFinite(a.cost) && a.cost >= 0, 'finite nonnegative cost');
  check(Number.isFinite(a.lagMonths) && a.lagMonths >= 0, 'finite nonnegative lag');
  for (const id of [...a.constraints.requires, ...a.constraints.excludes]) check(actions.has(id), 'valid action reference');
  for (const [district, values] of Object.entries(a.effects)) {
    check(districtIds.has(district), 'known effect district');
    for (const [dimension, amount] of Object.entries(values)) check(dims.includes(dimension) && Number.isFinite(amount), 'valid effect');
  }
  if (a.availability.kind === 'event') check(events.has(a.availability.eventId), 'known availability event');
}
function evaluateValidFixture(result, eventId) {
  check(result.valid === true, 'valid result expected');
  check(result.plan.actionIds.length === 5, 'exactly five');
  const ids = new Set(result.plan.actionIds);
  check(ids.size === 5, 'unique five');
  const selected = result.plan.actionIds.map((id) => actions.get(id));
  check(selected.every(Boolean), 'known IDs');
  const total = selected.reduce((s, a) => s + a.cost, 0);
  close(result.totalCost, total, 'total cost');
  check(total <= 100, 'within budget');
  close(result.remainingBudget, 100 - total, 'remaining budget');
  for (const a of selected) {
    check(a.availability.kind === 'always' || a.availability.eventId === eventId, 'availability');
    check(a.constraints.requires.every((id) => ids.has(id)), 'requirements');
    check(a.constraints.excludes.every((id) => !ids.has(id)), 'exclusions');
    const event = events.get(eventId);
    check(!event || event.kind !== 'cancellation' || event.blockedActionId !== a.id, 'blocked action absent');
  }
  let totalScore = 0;
  for (const district of catalog.districts) {
    const districtResult = result.metrics.districts.find((d) => d.districtId === district.id);
    let districtScore = 0;
    for (const k of dims) {
      const effect = selected.reduce((s, a) => s + (catalog.config.horizonMonths >= a.lagMonths ? (a.effects[district.id]?.[k] ?? 0) : 0), 0);
      const metric = Math.max(0, Math.min(100, district.baseline[k] + effect));
      close(districtResult.after[k], metric, 'district metric');
      districtScore += metric * catalog.config.dimensionWeights[k];
    }
    close(districtResult.scoreAfter, districtScore, 'district score');
    totalScore += districtScore * district.weight;
  }
  close(result.officialScore, totalScore, 'official score');
}
const base = (await load('src/mocks/simulate.valid.json')).data;
evaluateValidFixture(base);
for (const name of ['simulate.invalid-four', 'simulate.invalid-six']) {
  const invalid = (await load(`src/mocks/${name}.json`)).data;
  check(invalid.valid === false && invalid.officialScore === null && invalid.metrics === null, 'invalid plan has no score/metrics');
  check(invalid.plan.actionIds.length !== 5, 'invalid count fixture');
}
for (const prefix of ['event', 'opportunity']) {
  const preview = (await load(`src/mocks/${prefix}.preview.json`)).data;
  const confirmed = (await load(`src/mocks/${prefix}.confirm.json`)).data;
  check(JSON.stringify(preview.base) === JSON.stringify(base), 'preview preserves baseline');
  check(JSON.stringify(confirmed.base) === JSON.stringify(base), 'confirm preserves baseline');
  evaluateValidFixture(confirmed.branch, preview.event.id);
  close(confirmed.comparison.scoreDelta, confirmed.branch.officialScore - base.officialScore, 'score comparison');
  check(preview.replacementOptions.length <= 3, 'maximum three options');
  let previous;
  for (const option of preview.replacementOptions) {
    evaluateValidFixture(option.result, preview.event.id);
    close(option.comparison.scoreDelta, option.result.officialScore - base.officialScore, 'candidate delta');
    check(base.plan.actionIds.includes(option.removedActionId), 'removes existing action');
    check(!base.plan.actionIds.includes(option.addedActionId), 'adds new action');
    const key = Math.round(option.result.officialScore * 1e9);
    if (previous) check(previous.key > key || (previous.key === key && previous.cost <= option.result.totalCost), 'stable score/cost order');
    previous = { key, cost: option.result.totalCost };
  }
}
const cancel = (await load('src/mocks/event.preview.json')).data;
check(cancel.draft.actionIds.length === 4 && cancel.draftResult.officialScore === null, 'cancellation draft');
close(cancel.draftResult.remainingBudget, 40, 'replacement budget includes old remainder');
const golden = await load('verification/golden-summary.json');
close(base.officialScore, golden.baseScore, 'golden baseline');
const confirmed = (await load('src/mocks/event.confirm.json')).data;
close(confirmed.branch.officialScore, golden.newScore, 'golden changed score');
close(confirmed.branch.totalCost, 96, 'replacement cost greater than cancelled action still fits');
console.log(`PASS: ${checks} fixture/catalog/math assertions. No application, HTTP, browser, or live AI tests were run.`);
