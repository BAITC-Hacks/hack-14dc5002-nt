import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";
import { previewEvent, confirmEvent } from "@/lib/simulation/events";
import { simulatePlan } from "@/lib/simulation";
import type { EventConfirmInput } from "@/contracts/organizer-api";

const provider = vi.hoisted(() => ({ parse: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { parse: provider.parse };
    constructor(options: unknown) { provider.construct(options); }
  },
}));

let POST: typeof import("@/app/api/explain/route").POST;
const demo = () => getOrganizerCatalog().demoPlan;
const send = (body: unknown, token?: string, signal?: AbortSignal) => POST(new Request("http://localhost/api/explain", {
  method: "POST", body: JSON.stringify(body), signal,
  headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
}));
const base = (language = "ru") => ({ kind: "base", plan: demo(), language });
function enableAi() {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
  vi.stubEnv("OPENAI_MODEL", "test-model");
  vi.stubEnv("EXPLAIN_AI_ACCESS_TOKEN", "test-access");
}
function change(): EventConfirmInput {
  const input = { eventId: "cancel-action" as const, eventVersion: "team-events-v2", cancelledActionId: "M7", basePlan: demo() };
  const option = previewEvent(input, getOrganizerCatalog()).replacementOptions[0];
  return { ...input, removedActionId: option.removedActionId, addedActionId: option.addedActionId, addedDistrictId: option.addedSelection.districtId };
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("AI_ENABLED", "false");
  vi.stubEnv("AI_LOCAL_DEMO", "false");
  vi.stubEnv("EXPLAIN_AI_ACCESS_TOKEN", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_MODEL", "");
  vi.stubEnv("AI_TIMEOUT_MS", "12000");
  provider.parse.mockReset();
  provider.parse.mockResolvedValue({ status: "completed", output_parsed: { factIds: ["action:M7", "action:M8"] } });
  POST = (await import("@/app/api/explain/route")).POST;
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("organizer explanations", () => {
  it.each(["ru", "kk", "en"])("returns useful %s templates without provider configuration", async (language) => {
    const response = await send(base(language));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ source: "template", language });
    expect(body.data.observations).toHaveLength(5);
    expect(body.data.summary).toContain("95");
    expect(body.data.summary).toMatch(language === "en" ? /Five-action/ : language === "kk" ? /Бес шарадан/ : /План из пяти/);
    expect(provider.construct).not.toHaveBeenCalled();
  });
  it("defaults to Russian and never trusts extra numeric or prompt fields", async () => {
    expect((await (await send({ kind: "base", plan: demo() })).json()).data.language).toBe("ru");
    for (const field of ["officialScore", "totalCost", "prompt", "model", "source"]) {
      expect((await send({ ...base(), [field]: 999 })).status).toBe(400);
    }
    expect((await send(base("fr"))).status).toBe(400);
  });
  it("rejects invalid plans and old model versions before calling AI", async () => {
    enableAi();
    const plan = demo();
    expect((await send({ ...base(), plan: { ...plan, selections: plan.selections.slice(0, 4) } }, "test-access")).status).toBe(422);
    expect((await send({ ...base(), plan: { ...plan, modelVersion: "old" } }, "test-access")).status).toBe(409);
    expect(provider.parse).not.toHaveBeenCalled();
  });
  it("recalculates confirmed changes and keeps the original plan intact", async () => {
    const input = change();
    const before = JSON.stringify(input);
    const confirmed = confirmEvent(input, getOrganizerCatalog());
    const body = await (await send({ kind: "event", change: input, language: "en" })).json();
    expect(body.data.summary).toContain(new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(confirmed.branch.officialScore));
    expect(body.data.observations[0].actionIds).toEqual([input.removedActionId, input.addedActionId]);
    expect(body.data.observations[1].actionIds).toEqual([input.addedActionId]);
    expect(JSON.stringify(input)).toBe(before);
    expect((await send({ kind: "event", change: { ...input, addedActionId: "fake" } })).status).toBe(422);
    expect((await send({ kind: "event", change: { ...input, eventVersion: "stale" } })).status).toBe(409);
  });
  it("supports the optional required-action scenario using confirmed engine results", async () => {
    const input = { eventId: "require-action" as const, eventVersion: "team-events-v3", requiredActionId: "M1", basePlan: demo() };
    const option = previewEvent(input, getOrganizerCatalog()).replacementOptions[0];
    const response = await send({ kind: "event", language: "kk", change: {
      ...input, removedActionId: option.removedActionId, addedActionId: option.addedActionId, addedDistrictId: option.addedSelection.districtId,
    } });
    expect(response.status).toBe(200);
    expect((await response.json()).data.source).toBe("template");
  });
  it.each(["ru", "kk", "en"] as const)("explains removed effects, district comparison and lost synergy in %s", async (language) => {
    const { buildExplanation } = await import("@/lib/server/explanation-templates");
    const input: EventConfirmInput = {
      basePlan: demo(), eventId: "cancel-action", eventVersion: "team-events-v2",
      cancelledActionId: "M10", removedActionId: "M10", addedActionId: "M11", addedDistrictId: "nura",
    };
    const catalog = getOrganizerCatalog();
    const confirmed = confirmEvent(input, catalog);
    const explanation = buildExplanation({ catalog, result: confirmed.branch, base: confirmed.base, comparison: confirmed.comparison, change: input }, language);
    expect(explanation.facts.some((fact) => fact.id === "removed-action:M10")).toBe(true);
    expect(explanation.facts.some((fact) => fact.id === "event-district:nura")).toBe(true);
    expect(explanation.facts.some((fact) => fact.id.startsWith("lost-synergy:"))).toBe(true);
    expect(explanation.template.observations).toHaveLength(5);
    expect(explanation.template.observations[2].actionIds).toEqual(["M10"]);
    expect(explanation.template.observations[3].districtIds).toEqual(["nura"]);
    expect(explanation.template.observations[4].actionIds).toEqual(["M10", "M12"]);
    expect(explanation.template.observations[3].text).toContain(new Intl.NumberFormat(language === "en" ? "en-US" : language === "kk" ? "kk-KZ" : "ru-RU", { maximumFractionDigits: 3 }).format(confirmed.comparison.districts.find((district) => district.districtId === "nura")!.scoreDelta));
  });
  it("requires access protection even when the caller claims localhost", async () => {
    enableAi();
    for (const token of [undefined, "wrong"]) {
      expect((await (await send(base(), token)).json()).data.source).toBe("template");
    }
    expect(provider.parse).not.toHaveBeenCalled();
  });
  it.each(["OPENAI_API_KEY", "OPENAI_MODEL"])("falls back when %s is missing despite AI being enabled", async (name) => {
    enableAi();
    vi.stubEnv(name, "");
    expect((await (await send(base(), "test-access")).json()).data.source).toBe("template");
    expect(provider.construct).not.toHaveBeenCalled();
  });
  it("permits only explicit local-development opt-in without a bearer token", async () => {
    enableAi();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_LOCAL_DEMO", "true");
    expect((await (await send(base())).json()).data.source).toBe("ai");
    expect(provider.parse).toHaveBeenCalledTimes(1);
  });
  it("ignores the local-demo flag in production", async () => {
    enableAi();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_LOCAL_DEMO", "true");
    expect((await (await send(base())).json()).data.source).toBe("template");
    expect(provider.parse).not.toHaveBeenCalled();
  });
  it("accepts same-origin loopback browser calls when Next rewrites its internal hostname", async () => {
    enableAi();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_LOCAL_DEMO", "true");
    const response = await POST(new Request("http://localhost:3000/api/explain", {
      method: "POST", body: JSON.stringify(base()),
      headers: { "Content-Type": "application/json", host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    }));
    expect((await response.json()).data.source).toBe("ai");
    expect(provider.parse).toHaveBeenCalledTimes(1);
  });
  it.each([
    { origin: "https://unrelated.example", "content-type": "application/json" },
    { origin: "http://localhost", "content-type": "text/plain" },
    { origin: "null", "content-type": "application/json" },
  ])("does not spend on cross-origin/simple browser calls", async (headers) => {
    enableAi();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_LOCAL_DEMO", "true");
    const response = await POST(new Request("http://localhost/api/explain", { method: "POST", headers, body: JSON.stringify(base()) }));
    expect((await response.json()).data.source).toBe("template");
    expect(provider.parse).not.toHaveBeenCalled();
  });
  it("uses only vetted facts, lazy Responses SDK and canonical isolated cache entries", async () => {
    enableAi();
    const first = await (await send(base("en"), "test-access")).json();
    expect(first.data.source).toBe("ai");
    expect(first.data.limitation).toContain("only selects and orders");
    expect(provider.construct).toHaveBeenCalledWith(expect.objectContaining({ timeout: 12_000, maxRetries: 0 }));
    expect(provider.parse).toHaveBeenCalledWith(expect.objectContaining({ model: "test-model", store: false, max_output_tokens: 500 }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    first.data.observations[0].text = "corrupted";
    const reordered = base("en");
    reordered.plan.selections.reverse();
    const second = await (await send(reordered, "test-access")).json();
    expect(second.data.observations[0].text).not.toBe("corrupted");
    expect(provider.parse).toHaveBeenCalledTimes(1);
    await send(base("kk"), "test-access");
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });
  it.each([
    null, "bad JSON", { factIds: ["action:fake", "district:unknown"] },
    { factIds: ["action:M7", "action:M7"] }, { factIds: ["action:M7"] },
    { factIds: ["action:M7", "action:M8"], summary: "Score 999" },
  ])("falls back for refusal, invalid schema or untrusted facts: %j", async (output) => {
    enableAi();
    provider.parse.mockResolvedValue({ status: "completed", output_parsed: output });
    expect((await (await send(base(), "test-access")).json()).data.source).toBe("template");
  });
  it("falls back for incomplete and failed provider responses without disclosing details", async () => {
    enableAi();
    provider.parse.mockResolvedValueOnce({ status: "incomplete", output_parsed: { factIds: ["action:M7", "action:M8"] } });
    expect((await (await send(base(), "test-access")).json()).data.source).toBe("template");
    provider.parse.mockRejectedValueOnce(new Error("private provider failure"));
    const response = await send(base(), "test-access");
    expect(await response.text()).not.toContain("private provider failure");
  });
  it("honors an explicit refusal even if a malformed response also supplies parsed facts", async () => {
    enableAi();
    provider.parse.mockResolvedValue({ status: "completed", output_parsed: { factIds: ["action:M7", "action:M8"] },
      output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] });
    expect((await (await send(base(), "test-access")).json()).data.source).toBe("template");
  });
  it("requires event explanations to include the confirmed swap", async () => {
    enableAi();
    const input = change();
    provider.parse.mockResolvedValueOnce({ status: "completed", output_parsed: { factIds: ["action:M8", "action:M5"] } });
    expect((await (await send({ kind: "event", change: input }, "test-access")).json()).data.source).toBe("template");
    provider.parse.mockResolvedValueOnce({ status: "completed", output_parsed: { factIds: ["confirmed-swap", `action:${input.addedActionId}`, `removed-action:${input.removedActionId}`] } });
    const body = await (await send({ kind: "event", change: input }, "test-access")).json();
    expect(body.data.source).toBe("ai");
    expect(body.data.observations[0].actionIds).toContain(input.removedActionId);
  });
  it("limits provider failures to six paid attempts per minute in this process", async () => {
    enableAi();
    provider.parse.mockRejectedValue(new Error("unavailable"));
    for (let index = 0; index < 7; index += 1) {
      expect((await (await send(base(), "test-access")).json()).data.source).toBe("template");
    }
    expect(provider.parse).toHaveBeenCalledTimes(6);
  });
  it("times out at twelve seconds and uses the template", async () => {
    enableAi();
    vi.useFakeTimers();
    provider.parse.mockImplementation((_body, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }));
    const response = send(base(), "test-access");
    await vi.advanceTimersByTimeAsync(12_000);
    expect((await (await response).json()).data.source).toBe("template");
    expect(provider.parse).toHaveBeenCalledTimes(1);
  });
  it("propagates cancellation and does not turn an aborted request into an AI success", async () => {
    enableAi();
    const controller = new AbortController();
    const { explainPlan } = await import("@/lib/server/explanation");
    provider.parse.mockImplementation((_body, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }));
    const pending = explainPlan({ kind: "base", plan: demo() }, new Request("http://localhost", {
      signal: controller.signal, headers: { authorization: "Bearer test-access" },
    }));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("keeps numerical engine results independent of explanation selection", async () => {
    enableAi();
    const expected = simulatePlan(demo(), getOrganizerCatalog());
    await send(base(), "test-access");
    expect(simulatePlan(demo(), getOrganizerCatalog())).toEqual(expected);
  });
});
