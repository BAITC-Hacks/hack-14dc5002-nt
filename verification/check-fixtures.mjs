/** Offline regression check for the organizer-provided catalog and deterministic engine. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { simulatePlan, validatePlan } from "../src/lib/simulation/index.ts";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("src/data/catalog.json", root), "utf8"));
const mockCatalog = JSON.parse(await readFile(new URL("src/mocks/catalog.json", root), "utf8"));
const requests = JSON.parse(await readFile(new URL("src/mocks/requests.json", root), "utf8"));
const golden = JSON.parse(await readFile(new URL("verification/golden-summary.json", root), "utf8"));
let checks = 0;
const check = (condition, description) => { assert.ok(condition, description); checks += 1; };
const close = (actual, expected, description) => check(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-6, description);

check(catalog.config.modelVersion === "organizer-v1", "organizer model version");
check(catalog.districts.length === 5, "five source districts");
check(catalog.actions.length === 14, "fourteen source actions");
check(catalog.events.length === 0, "no invented events");
check(JSON.stringify(mockCatalog) === JSON.stringify(catalog), "mock catalog mirrors server catalog");
close(catalog.districts.reduce((sum, district) => sum + district.populationWeight, 0), 1, "population weights total one");
close(Object.values(catalog.config.indicatorWeights).reduce((sum, weight) => sum + weight, 0), 1, "indicator weights total one");
check(new Set(catalog.actions.map((action) => action.id)).size === 14, "unique action IDs");
const baseline = simulatePlan({ modelVersion: catalog.config.modelVersion, selections: [] }, catalog);
check(!baseline.valid && baseline.officialScore === null, "empty selection has no score");
const result = simulatePlan(catalog.demoPlan, catalog);
const validMock = JSON.parse(await readFile(new URL("src/mocks/simulate.valid.json", root), "utf8")).data;
check(JSON.stringify(validMock) === JSON.stringify(result), "valid simulation mock is produced by engine");
check(result.valid, "golden plan valid");
close(result.totalCost, 95, "golden plan price");
close(result.metrics.baselineOfficialScore, golden.baselineScore, "baseline Score");
close(result.metrics.populationWeightedAverage, golden.populationWeightedAverage, "result population average");
close(result.metrics.weakestDistrictScore, golden.weakestDistrictScore, "result weakest district");
check(result.metrics.criticalCount === golden.criticalCount, "result critical count");
close(result.officialScore, golden.score, "golden Score");
close(result.metrics.deltaFromBaseline, golden.delta, "Score delta");
check(result.metrics.synergiesApplied.length === 1 && result.metrics.synergiesApplied[0].districtId === "nura", "M10/M12 synergy district");
check(validatePlan(catalog.demoPlan, catalog).length === 0, "golden plan passes validator");

for (const count of [4, 6]) {
  const selections = catalog.demoPlan.selections.slice(0, 5);
  if (count === 4) selections.pop();
  else selections.push({ actionId: "M1", districtId: "esil" });
  const invalid = simulatePlan({ modelVersion: catalog.config.modelVersion, selections }, catalog);
  check(!invalid.valid && invalid.officialScore === null && invalid.metrics === null && invalid.trace.length === 0, `${count} decisions invalid without score`);
  const fixtureName = count === 4 ? "simulate.invalid-four.json" : "simulate.invalid-six.json";
  const fixture = JSON.parse(await readFile(new URL(`src/mocks/${fixtureName}`, root), "utf8")).data;
  check(JSON.stringify(fixture) === JSON.stringify(invalid), `${count}-decision mock is produced by engine`);
}
check(requests.simulateValid.modelVersion === catalog.config.modelVersion, "mock request uses current model version");
check(requests.simulateValid.selections.length === 5, "mock request includes five selections");
check(JSON.stringify(requests.simulateValid) === JSON.stringify(catalog.demoPlan), "catalog demo request matches golden portfolio");

console.log(`PASS: ${checks} organizer-v1 data/formula assertions.`);
