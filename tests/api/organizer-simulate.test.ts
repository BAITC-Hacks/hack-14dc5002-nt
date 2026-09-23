import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/simulate/route";
import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";

const send = (body: unknown) => POST(new Request("http://localhost/api/simulate", { method: "POST", body: JSON.stringify(body) }));
const demo = () => getOrganizerCatalog().demoPlan;

describe("live organizer simulation", () => {
  it("reproduces Nikita's result, independent of legacy mocks", async () => {
    const response = await send(demo());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ valid: true, totalCost: 95 });
    expect(body.data.officialScore).toBeCloseTo(56.54307, 6);
  });
  it("calculates an arbitrary plan not present in fixtures", async () => {
    const plan = demo();
    plan.selections[0].districtId = "esil";
    const body = await (await send(plan)).json();
    expect(body.data.valid).toBe(true);
    expect(body.data.officialScore).not.toBeCloseTo(56.54307, 6);
  });
  it.each([4, 6])("returns null score for %i decisions", async (count) => {
    const plan = demo();
    plan.selections = count === 4 ? plan.selections.slice(0, 4) : [...plan.selections, { actionId: "M1", districtId: "esil" }];
    const response = await send(plan);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { valid: false, officialScore: null, metrics: null } });
  });
  it.each(["officialScore", "totalCost", "eventId", "catalog"])("rejects client-supplied %s", async (field) => {
    expect((await send({ ...demo(), [field]: 99 })).status).toBe(400);
  });
  it("rejects forged selection parameters, old model and malformed JSON", async () => {
    const plan = demo();
    expect((await send({ ...plan, selections: [{ ...plan.selections[0], cost: 0 }] })).status).toBe(400);
    expect((await send({ ...plan, modelVersion: "demo-v1" })).status).toBe(409);
    expect((await POST(new Request("http://localhost/api/simulate", { method: "POST", body: "{" }))).status).toBe(400);
  });
  it("isolates the authoritative catalog from callers", () => {
    const catalog = getOrganizerCatalog();
    catalog.actions[0].cost = -1;
    expect(getOrganizerCatalog().actions[0].cost).toBe(18);
  });
});
