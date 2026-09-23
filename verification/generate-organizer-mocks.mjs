// Explicit fixtures for the new UI adapter, not the implementation of the real API.
import fs from "node:fs";
import { simulatePlan } from "../src/lib/simulation/index.ts";
import { previewEvent, confirmEvent } from "../src/lib/simulation/events.ts";
import { ACTION_CANCELLATION_EVENT, SCHOOL_CANCELLATION_EVENT, REQUIRED_ACTION_EVENT } from "../src/data/team-events.ts";

const raw = JSON.parse(fs.readFileSync(new URL("../src/data/organizer-catalog.json", import.meta.url), "utf8"));
const catalog = { ...raw, teamEvents: [ACTION_CANCELLATION_EVENT, SCHOOL_CANCELLATION_EVENT, REQUIRED_ACTION_EVENT].map(({ id, version, kind, source, title, disclaimer }) => ({ id, version, modelVersion: raw.config.modelVersion, kind, source, title, disclaimer })) };
const scenarios = [];
const add = (operation, input, data) => scenarios.push({ operation, input, response: { ok: true, data } });
add("catalog", null, catalog);
for (const selections of [catalog.demoPlan.selections, catalog.demoPlan.selections.slice(0, 4), [...catalog.demoPlan.selections, { actionId: "M1", districtId: "esil" }]]) {
  const plan = { modelVersion: catalog.config.modelVersion, selections };
  add("simulate", plan, simulatePlan(plan, catalog));
}
for (const input of [
  { basePlan: catalog.demoPlan, eventId: "cancel-action", eventVersion: "team-events-v2", cancelledActionId: "M7" },
  { basePlan: catalog.demoPlan, eventId: "cancel-m7", eventVersion: "team-events-v1" },
  { basePlan: catalog.demoPlan, eventId: "require-action", eventVersion: "team-events-v3", requiredActionId: "M14" },
  { basePlan: catalog.demoPlan, eventId: "require-action", eventVersion: "team-events-v3", requiredActionId: "M12" },
]) {
  const preview = previewEvent(input, catalog);
  add("preview", input, preview);
  for (const option of preview.replacementOptions) {
    const change = { ...input, removedActionId: option.removedActionId, addedActionId: option.addedActionId, ...(option.addedSelection.districtId ? { addedDistrictId: option.addedSelection.districtId } : {}) };
    add("confirm", change, confirmEvent(change, catalog));
  }
}
const output = new URL("../src/mocks/organizer/scenarios.json", import.meta.url);
fs.mkdirSync(new URL("../src/mocks/organizer/", import.meta.url), { recursive: true });
fs.writeFileSync(output, JSON.stringify(scenarios, null, 2) + "\n");
console.log(`Generated ${scenarios.length} explicit organizer mock scenarios.`);
