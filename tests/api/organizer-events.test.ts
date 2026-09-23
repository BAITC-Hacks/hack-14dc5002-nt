import { describe, expect, it } from "vitest";
import { POST as preview } from "@/app/api/events/preview/route";
import { POST as confirm } from "@/app/api/events/confirm/route";
import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";

const cancellation = () => ({ basePlan: getOrganizerCatalog().demoPlan, eventId: "cancel-action", eventVersion: "team-events-v2", cancelledActionId: "M7" });
const opportunity = (id = "M14") => ({ basePlan: getOrganizerCatalog().demoPlan, eventId: "require-action", eventVersion: "team-events-v3", requiredActionId: id });
const request = (input: unknown) => new Request("http://localhost/api/events", { method: "POST", body: JSON.stringify(input) });
const replacement = { removedActionId: "M7", addedActionId: "M9", addedDistrictId: "nura" };

describe("organizer events over HTTP", () => {
  it("cancels M7, leaves an unscored draft and refunds its authoritative price", async () => {
    const response = await preview(request(cancellation()));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({ refundAmount: 24, availableBudget: 29, draftResult: { valid: false, officialScore: null, metrics: null } });
    expect(data.draft.selections).toHaveLength(4);
    expect(data.base.totalCost).toBe(95);
    expect(data.base.officialScore).toBeCloseTo(56.54307, 6);
    expect(data.replacementOptions.length).toBeGreaterThan(0);
    expect(data.replacementOptions.length).toBeLessThanOrEqual(3);
  });
  it("confirms every recommendation, preserving its target and original snapshot", async () => {
    const input = cancellation();
    const snapshot = structuredClone(input);
    const { data } = await (await preview(request(input))).json();
    for (const option of data.replacementOptions) {
      const result = await confirm(request({ ...input, removedActionId: option.removedActionId, addedActionId: option.addedActionId, addedDistrictId: option.addedSelection.districtId }));
      expect(result.status).toBe(200);
      const { data: confirmed } = await result.json();
      expect(confirmed.base).toEqual(data.base);
      expect(confirmed.branch).toEqual(option.result);
      expect(confirmed.branch.plan.selections).toHaveLength(5);
    }
    expect(input).toEqual(snapshot);
    expect((await (await preview(request(input))).json()).data).toEqual(data);
  });
  it.each([
    { eventVersion: "stale" },
    { basePlan: { ...getOrganizerCatalog().demoPlan, modelVersion: "stale" } },
  ])("rejects stale versions with 409", async (extra) => {
    expect((await preview(request({ ...cancellation(), ...extra }))).status).toBe(409);
  });
  it.each([
    { cancelledActionId: "M99" },
    { basePlan: { ...getOrganizerCatalog().demoPlan, selections: [] } },
  ])("rejects an inapplicable cancellation", async (extra) => {
    expect((await preview(request({ ...cancellation(), ...extra }))).status).toBe(422);
  });
  it.each([
    { eventId: "invented" }, { officialScore: 100 }, { requiredActionId: "M14" },
    { cancelledActionId: undefined }, { eventVersion: undefined },
  ])("rejects malformed or mixed event inputs", async (extra) => {
    expect((await preview(request({ ...cancellation(), ...extra }))).status).toBe(400);
  });
  it.each([
    { removedActionId: "M8" }, { addedActionId: "M7" }, { addedActionId: "M99" },
    { addedDistrictId: "unknown" }, { addedDistrictId: undefined },
    { addedActionId: "M14", addedDistrictId: "nura" },
  ])("revalidates confirmation independently of preview", async (extra) => {
    expect((await confirm(request({ ...cancellation(), ...replacement, ...extra }))).status).toBe(422);
  });
  it("supports school cancellation compatibility without an explicit target", async () => {
    const response = await preview(request({ basePlan: getOrganizerCatalog().demoPlan, eventId: "cancel-m7", eventVersion: "team-events-v1" }));
    expect(response.status).toBe(200);
  });
  it("mandatory action returns options and confirms exactly the requested action", async () => {
    const input = opportunity();
    const { data } = await (await preview(request(input))).json();
    expect(data.status).toBe("replacement-required");
    expect(data.draftResult).toBeUndefined();
    const option = data.replacementOptions[0];
    expect(option.availableBudget).toBeGreaterThanOrEqual(16);
    const response = await confirm(request({ ...input, removedActionId: option.removedActionId, addedActionId: option.addedActionId }));
    expect(response.status).toBe(200);
    expect((await response.json()).data.branch).toEqual(option.result);
    expect((await confirm(request({ ...input, removedActionId: option.removedActionId, addedActionId: "M2" }))).status).toBe(422);
  });
  it("reports already satisfied, and does not allow a gratuitous confirmation", async () => {
    const input = opportunity("M12");
    expect((await (await preview(request(input))).json()).data).toMatchObject({ status: "already-satisfied", requiresReplacement: false, replacementOptions: [] });
    expect((await confirm(request({ ...input, removedActionId: "M7", addedActionId: "M12" }))).status).toBe(422);
  });
});
