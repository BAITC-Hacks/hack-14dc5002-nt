import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";
import type { PlanInput } from "@/contracts/organizer-api";

let api: typeof import("@/lib/organizer-api");
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "true");
  api = await import("@/lib/organizer-api");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("organizer client", () => {
  it("has separate organizer fixtures and isolated response objects", async () => {
    const first = await api.getCatalog();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.config.modelVersion).toBe("organizer-v1");
    expect(first.data.teamEvents).toHaveLength(3);
    first.data.actions[0].cost = -100;
    expect(await api.getCatalog()).toEqual({ ok: true, data: getOrganizerCatalog() });
  });
  it("matches reordered selections but never substitutes another district", async () => {
    const plan: PlanInput = getOrganizerCatalog().demoPlan;
    const expected = await api.simulate(plan);
    expect(await api.simulate({ ...plan, selections: [...plan.selections].reverse() })).toEqual(expected);
    plan.selections[0].districtId = "esil";
    expect(await api.simulate(plan)).toMatchObject({ ok: false, error: { code: "MOCK_SCENARIO_NOT_DEFINED" } });
  });
  it("previews cancellation and confirms all returned selections", async () => {
    const input = { basePlan: getOrganizerCatalog().demoPlan, eventId: "cancel-action" as const, eventVersion: "team-events-v2", cancelledActionId: "M7" };
    const result = await api.previewEvent(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const option of result.data.replacementOptions) {
      const confirmed = await api.confirmEvent({ ...input, removedActionId: option.removedActionId, addedActionId: option.addedActionId, addedDistrictId: option.addedSelection.districtId });
      expect(confirmed).toMatchObject({ ok: true, data: { branch: option.result } });
    }
  });
  it("does not match stale event versions or unsupported targets", async () => {
    expect(await api.previewEvent({ basePlan: getOrganizerCatalog().demoPlan, eventId: "cancel-action", eventVersion: "stale", cancelledActionId: "M7" })).toMatchObject({ ok: false });
  });
  it("uses real transport with mock=false, supports abort and preserves API errors", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "false");
    api = await import("@/lib/organizer-api");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: false, error: { code: "MODEL_VERSION_MISMATCH", message: "stale" } }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    expect(await api.simulate(getOrganizerCatalog().demoPlan, controller.signal)).toMatchObject({ ok: false, error: { code: "MODEL_VERSION_MISMATCH" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/simulate", expect.objectContaining({ method: "POST", signal: controller.signal }));
    fetchMock.mockRejectedValue(new Error("private details"));
    controller.abort();
    expect(await api.getCatalog(controller.signal)).toMatchObject({ ok: false, error: { code: "REQUEST_ABORTED" } });
    fetchMock.mockResolvedValue(Response.json({ strange: true }));
    expect(await api.getCatalog()).toMatchObject({ ok: false, error: { code: "INVALID_RESPONSE" } });
  });
});
