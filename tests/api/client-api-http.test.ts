import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResponse, Catalog } from "@/contracts";
import catalog from "@/data/catalog.json";
import requests from "@/mocks/requests.json";

let api: typeof import("@/lib/client-api");
const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "false");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  api = await import("@/lib/client-api");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("client API HTTP transport", () => {
  it("stops the legacy dashboard from reading an incompatible organizer catalog", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true, data: { config: { modelVersion: "organizer-v1" } } }));
    await expect(api.getCatalog()).resolves.toMatchObject({ ok: false, error: { code: "UI_CONTRACT_OUTDATED" } });
  });
  it("fetches the catalog with GET when mock mode is disabled", async () => {
    const payload = { ok: true, data: catalog };
    fetchMock.mockResolvedValueOnce(Response.json(payload));

    await expect(api.getCatalog()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/catalog", {
      method: "GET", headers: undefined, body: undefined,
    });
  });

  it.each([
    ["simulate", "/api/simulate", requests.simulateValid],
    ["previewEvent", "/api/events/preview", requests.eventPreview],
    ["confirmEvent", "/api/events/confirm", requests.eventConfirm],
    ["explain", "/api/explain", { kind: "base" as const, plan: requests.explainBase.plan }],
  ] as const)("sends %s to its real endpoint as JSON", async (method, path, input) => {
    const payload = { ok: false, error: { code: "MODEL_VERSION_MISMATCH", message: "Model changed" } };
    fetchMock.mockResolvedValueOnce(Response.json(payload, { status: 409 }));

    let result: unknown;
    switch (method) {
      case "simulate": result = await api.simulate(input); break;
      case "previewEvent": result = await api.previewEvent(input); break;
      case "confirmEvent": result = await api.confirmEvent(input); break;
      case "explain": result = await api.explain(input); break;
    }

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it.each([400, 422, 429, 500])("preserves the API error envelope for HTTP %i", async (status) => {
    const payload: ApiResponse<Catalog> = { ok: false, error: { code: "SERVER_ERROR", message: "Request failed" } };
    fetchMock.mockResolvedValueOnce(Response.json(payload, { status }));
    await expect(api.getCatalog()).resolves.toEqual(payload);
  });

  it("returns NETWORK_ERROR when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Internal connection details"));
    await expect(api.simulate(requests.simulateValid)).resolves.toEqual({
      ok: false, error: { code: "NETWORK_ERROR", message: "Не удалось связаться с сервером." },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns NETWORK_ERROR for an HTML error response instead of throwing", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Not found</html>", { status: 404 }));
    await expect(api.getCatalog()).resolves.toMatchObject({ ok: false, error: { code: "NETWORK_ERROR" } });
  });
});
