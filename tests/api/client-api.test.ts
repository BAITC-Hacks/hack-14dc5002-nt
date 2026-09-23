import { describe, expect, it, vi } from "vitest";
import type { ExplainInput } from "@/contracts";
import catalog from "@/data/catalog.json";
import requests from "@/mocks/requests.json";

vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "true");
const { getCatalog, simulate, explain } = await import("@/lib/client-api");

describe("catalog contract", () => {
  it("loads a catalog matching the shared model version", async () => {
    const response = await getCatalog();
    expect(response.ok).toBe(true);
    if (response.ok) expect(response.data.config.modelVersion).toBe(catalog.config.modelVersion);
  });

  it("matches mock plans by normalized IDs and rejects unknown plans", async () => {
    const known = requests.simulateValid;
    const matched = await simulate({ ...known, actionIds: [...known.actionIds].reverse() });
    expect(matched.ok).toBe(true);

    const unknown = await simulate({ modelVersion: known.modelVersion, actionIds: ["unknown"] });
    expect(unknown).toMatchObject({ ok: false, error: { code: "MOCK_SCENARIO_NOT_DEFINED" } });
  });

  it("only returns the explanation fixture for its matching confirmed event", async () => {
    const eventInput: ExplainInput = { kind: "event", change: requests.explainEvent.change };
    const baseInput: ExplainInput = { kind: "base", plan: requests.explainBase.plan };
    const confirmedEvent = await explain(eventInput);
    expect(confirmedEvent).toMatchObject({ ok: true, data: { source: "template" } });

    const basePlan = await explain(baseInput);
    expect(basePlan).toMatchObject({ ok: false, error: { code: "MOCK_SCENARIO_NOT_DEFINED" } });
  });
});
