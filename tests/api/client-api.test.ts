import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExplainInput, PlanInput } from "@/contracts";
import catalog from "@/data/catalog.json";
import requests from "@/mocks/requests.json";

let api: typeof import("@/lib/client-api");
const unsupported = { ok: false, error: { code: "MOCK_SCENARIO_NOT_DEFINED" } };
const reversedPlan = (plan: PlanInput): PlanInput => ({ ...plan, actionIds: [...plan.actionIds].reverse() });

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "true");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Mock mode must not access the network"); }));
  api = await import("@/lib/client-api");
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("client API mock scenarios", () => {
  it("loads a catalog matching the shared model version", async () => {
    await expect(api.getCatalog()).resolves.toEqual({ ok: true, data: catalog });
  });

  it("matches reordered plan IDs without mutating the request", async () => {
    const plan = reversedPlan(requests.simulateValid);
    const before = structuredClone(plan);
    const response = await api.simulate(plan);

    expect(response).toMatchObject({ ok: true, data: { valid: true, officialScore: 57, totalCost: 90 } });
    expect(plan).toEqual(before);
  });

  it.each([
    ["four", requests.simulateInvalidFour],
    ["six", requests.simulateInvalidSix],
  ])("returns no score or metrics for the %s-action fixture", async (_, plan) => {
    await expect(api.simulate(reversedPlan(plan))).resolves.toMatchObject({
      ok: true,
      data: { valid: false, officialScore: null, metrics: null, trace: [], errors: [{ code: "DECISION_COUNT" }] },
    });
  });

  it.each([
    ["unknown IDs", { ...requests.simulateValid, actionIds: ["unknown"] }],
    ["duplicate IDs", { ...requests.simulateValid, actionIds: Array(5).fill("bus_lanes") as string[] }],
    ["different version", { ...requests.simulateValid, modelVersion: "other-model" }],
  ])("rejects an unsupported plan with %s", async (_, plan) => {
    await expect(api.simulate(plan)).resolves.toMatchObject(unsupported);
  });

  it("previews cancellation as a four-action draft without changing the base", async () => {
    const input = { ...requests.eventPreview, basePlan: reversedPlan(requests.eventPreview.basePlan) };
    const before = structuredClone(input);
    const response = await api.previewEvent(input);

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.base).toMatchObject({ valid: true, officialScore: 57, totalCost: 90 });
    expect(response.data.draft.actionIds).toHaveLength(4);
    expect(response.data.draft.actionIds).not.toContain("school_new");
    expect(response.data.draftResult).toMatchObject({ valid: false, officialScore: null, metrics: null, remainingBudget: 40 });
    expect(response.data.replacementOptions.length).toBeGreaterThan(0);
    for (const option of response.data.replacementOptions) {
      expect(option.plan.actionIds).toHaveLength(5);
      expect(option.result.valid).toBe(true);
    }
    expect(input).toEqual(before);
  });

  it("previews an opportunity without adding a sixth action", async () => {
    const response = await api.previewEvent(requests.opportunityPreview);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.event.kind).toBe("opportunity");
    expect(response.data.requiresReplacement).toBe(true);
    expect(response.data.draft.actionIds).toHaveLength(5);
    expect(response.data.draftResult.valid).toBe(true);
    for (const option of response.data.replacementOptions) {
      expect(option.addedActionId).toBe("digital_grant");
      expect(option.plan.actionIds).toHaveLength(5);
      expect(option.result.valid).toBe(true);
    }
  });

  it.each([
    ["cancellation", requests.eventConfirm],
    ["opportunity", requests.opportunityConfirm],
  ])("confirms the %s fixture and preserves the base across repeated calls", async (_, input) => {
    const reordered = { ...input, basePlan: reversedPlan(input.basePlan) };
    const before = structuredClone(reordered);
    const response = await api.confirmEvent(reordered);

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.base).toMatchObject({ valid: true, officialScore: 57, totalCost: 90 });
    expect(response.data.branch.valid).toBe(true);
    expect(response.data.branch.plan.actionIds).toHaveLength(5);
    expect(response.data.branch.plan.actionIds).toContain(input.addedActionId);
    expect(response.data.branch.plan.actionIds).not.toContain(input.removedActionId);
    expect(response.data.comparison.scoreDelta).toBeCloseTo(response.data.branch.officialScore - response.data.base.officialScore);
    await expect(api.confirmEvent(reordered)).resolves.toEqual(response);
    await expect(api.simulate(input.basePlan)).resolves.toEqual({ ok: true, data: response.data.base });
    expect(reordered).toEqual(before);
  });

  it("returns the documented school replacement score and cost", async () => {
    const response = await api.confirmEvent(requests.eventConfirm);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.data.branch.officialScore).toBeCloseTo(56.6, 6);
    expect(response.data.branch.totalCost).toBe(96);
  });

  it.each([
    ["unknown event", { ...requests.eventPreview, eventId: "unknown" }],
    ["different base", { ...requests.eventPreview, basePlan: requests.simulateInvalidFour }],
    ["different version", { ...requests.eventPreview, basePlan: { ...requests.simulateValid, modelVersion: "other-model" } }],
  ])("rejects a preview with %s", async (_, input) => {
    await expect(api.previewEvent(input)).resolves.toMatchObject(unsupported);
  });

  it.each([
    ["unknown event", { ...requests.eventConfirm, eventId: "unknown" }],
    ["wrong removal", { ...requests.eventConfirm, removedActionId: "bus_lanes" }],
    ["wrong replacement", { ...requests.eventConfirm, addedActionId: "unknown" }],
    ["different base", { ...requests.eventConfirm, basePlan: requests.simulateInvalidFour }],
  ])("rejects a confirmation with %s", async (_, input) => {
    await expect(api.confirmEvent(input)).resolves.toMatchObject(unsupported);
  });

  it("returns the explanation fixture for its matching confirmed event", async () => {
    const input: ExplainInput = { kind: "event", change: { ...requests.explainEvent.change, basePlan: reversedPlan(requests.simulateValid) } };
    await expect(api.explain(input)).resolves.toMatchObject({ ok: true, data: { source: "template" } });
  });

  it("rejects explanations without a matching fixture", async () => {
    const inputs: ExplainInput[] = [
      { kind: "base", plan: requests.explainBase.plan },
      { kind: "event", change: requests.opportunityConfirm },
      { kind: "event", change: { ...requests.eventConfirm, addedActionId: "unknown" } },
      { kind: "event", change: { ...requests.eventConfirm, basePlan: requests.simulateInvalidFour } },
    ];
    for (const input of inputs) await expect(api.explain(input)).resolves.toMatchObject(unsupported);
  });

  it("isolates returned catalogs from later requests", async () => {
    const response = await api.getCatalog();
    const original = structuredClone(response);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    response.data.config.modelVersion = "changed-by-client";
    response.data.actions.pop();
    await expect(api.getCatalog()).resolves.toEqual(original);
  });

  it("isolates returned simulation results from later requests", async () => {
    const response = await api.simulate(requests.simulateValid);
    const original = structuredClone(response);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    response.data.totalCost = -1;
    response.data.plan.actionIds.pop();
    await expect(api.simulate(requests.simulateValid)).resolves.toEqual(original);
  });

  it("isolates returned event previews from later requests", async () => {
    const response = await api.previewEvent(requests.eventPreview);
    const original = structuredClone(response);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    response.data.base.plan.actionIds.pop();
    response.data.replacementOptions.pop();
    await expect(api.previewEvent(requests.eventPreview)).resolves.toEqual(original);
  });

  it("isolates returned event confirmations from later requests", async () => {
    const response = await api.confirmEvent(requests.eventConfirm);
    const original = structuredClone(response);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    response.data.base.totalCost = -1;
    response.data.branch.plan.actionIds.pop();
    await expect(api.confirmEvent(requests.eventConfirm)).resolves.toEqual(original);
  });

  it("isolates returned explanations from later requests", async () => {
    const input: ExplainInput = { kind: "event", change: requests.explainEvent.change };
    const response = await api.explain(input);
    const original = structuredClone(response);
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    response.data.summary = "changed-by-client";
    response.data.observations.pop();
    await expect(api.explain(input)).resolves.toEqual(original);
  });
});
