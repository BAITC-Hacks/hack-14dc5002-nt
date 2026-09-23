import { expect, test } from "@playwright/test";
import type { ApiResponse, Catalog, EventConfirmInput, EventPreviewInput, EventPreviewResult, EventConfirmResult, SimulationResult } from "../../src/contracts/organizer-api";

test("mock=false: catalog, arbitrary plan, cancellation and mandatory action over real HTTP", async ({ request }) => {
  const catalogResponse = await request.get("/api/catalog");
  expect(catalogResponse.status()).toBe(200);
  const payload = await catalogResponse.json() as ApiResponse<Catalog>;
  expect(payload.ok).toBe(true);
  if (!payload.ok) return;
  const catalog = payload.data;
  expect(catalog.config.modelVersion).toBe("organizer-v1");
  expect(catalog.teamEvents).toHaveLength(3);

  const baseResponse = await request.post("/api/simulate", { data: catalog.demoPlan });
  expect(baseResponse.status()).toBe(200);
  const base = (await baseResponse.json()).data;
  expect(base.officialScore).toBeCloseTo(56.54307, 6);
  expect(base.totalCost).toBe(95);

  const different = structuredClone(catalog.demoPlan);
  different.selections[0].districtId = "esil";
  const arbitrary = await request.post("/api/simulate", { data: different });
  const arbitraryData = (await arbitrary.json()).data as SimulationResult;
  expect(arbitraryData.valid).toBe(true);
  expect(arbitraryData.officialScore).not.toBeCloseTo(base.officialScore, 6);

  const scenarios: EventPreviewInput[] = [
    { basePlan: catalog.demoPlan, eventId: "cancel-action", eventVersion: "team-events-v2", cancelledActionId: "M7" },
    { basePlan: catalog.demoPlan, eventId: "require-action", eventVersion: "team-events-v3", requiredActionId: "M14" },
  ];
  for (const input of scenarios) {
    const previewResponse = await request.post("/api/events/preview", { data: input });
    expect(previewResponse.status()).toBe(200);
    const preview = (await previewResponse.json()).data as EventPreviewResult;
    expect(preview.base).toEqual(base);
    if ("draftResult" in preview) {
      expect(preview.draftResult.officialScore).toBeNull();
      expect(preview.availableBudget).toBe(29);
    }
    const option = preview.replacementOptions[0];
    expect(option).toBeDefined();
    const change: EventConfirmInput = { ...input, removedActionId: option.removedActionId, addedActionId: option.addedActionId, addedDistrictId: option.addedSelection.districtId };
    const confirmResponse = await request.post("/api/events/confirm", { data: change });
    expect(confirmResponse.status()).toBe(200);
    const confirmation = (await confirmResponse.json()).data as EventConfirmResult;
    expect(confirmation.branch).toEqual(option.result);
    expect(confirmation.base).toEqual(base);
    expect(confirmation.branch.plan.selections).toHaveLength(5);

    for (const language of ["ru", "kk", "en"]) {
      const response = await request.post("/api/explain", { data: { kind: "event", change, language } });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, data: { source: "template", language, summary: expect.any(String), observations: expect.any(Array) } });
    }
  }
  expect((await (await request.post("/api/simulate", { data: catalog.demoPlan })).json()).data).toEqual(base);
  for (const language of ["ru", "kk", "en"]) {
    const response = await request.post("/api/explain", { data: { kind: "base", plan: catalog.demoPlan, language } });
    expect(response.status()).toBe(200);
    expect((await response.json()).data).toMatchObject({ source: "template", language });
  }
});

test("real HTTP rejects spoofed calculations and invalid transitions", async ({ request }) => {
  const { data: catalog } = await (await request.get("/api/catalog")).json();
  expect((await request.post("/api/simulate", { data: { ...catalog.demoPlan, officialScore: 100 } })).status()).toBe(400);
  expect((await request.post("/api/simulate", { data: { ...catalog.demoPlan, modelVersion: "stale" } })).status()).toBe(409);
  expect((await request.post("/api/simulate", { data: "{", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
  for (const selections of [catalog.demoPlan.selections.slice(0, 4), [...catalog.demoPlan.selections, { actionId: "M14" }]]) {
    const response = await request.post("/api/simulate", { data: { ...catalog.demoPlan, selections } });
    expect(response.status()).toBe(200);
    expect((await response.json()).data).toMatchObject({ valid: false, officialScore: null, metrics: null });
  }
  const change = { basePlan: catalog.demoPlan, eventId: "cancel-action", eventVersion: "team-events-v2", cancelledActionId: "M7", removedActionId: "M8", addedActionId: "M9", addedDistrictId: "nura" };
  expect((await request.post("/api/events/confirm", { data: change })).status()).toBe(422);
  expect((await request.post("/api/explain", { data: { kind: "event", change } })).status()).toBe(422);
  expect((await request.post("/api/explain", { data: { kind: "base", plan: catalog.demoPlan, language: "fr" } })).status()).toBe(400);
});
