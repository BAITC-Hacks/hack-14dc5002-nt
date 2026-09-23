import { describe, expect, it } from "vitest";
import { readJsonRequest } from "@/lib/server/read-json-request";
import { planInputSchema } from "@/lib/server/request-schemas";

describe("readJsonRequest", () => {
  it("returns parsed data for a valid request", async () => {
    const request = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelVersion: "demo-v1", actionIds: ["a", "b", "c", "d"] }),
    });

    await expect(readJsonRequest(request, planInputSchema)).resolves.toMatchObject({
      ok: true,
      data: { modelVersion: "demo-v1", actionIds: ["a", "b", "c", "d"] },
    });
  });

  it("returns HTTP 400 for malformed JSON and strict-schema violations", async () => {
    const malformed = new Request("http://localhost/api/simulate", { method: "POST", body: "{" });
    const malformedResult = await readJsonRequest(malformed, planInputSchema);
    expect(malformedResult.ok).toBe(false);
    if (!malformedResult.ok) {
      expect(malformedResult.response.status).toBe(400);
      await expect(malformedResult.response.json()).resolves.toMatchObject({
        ok: false,
        error: { code: "INVALID_REQUEST" },
      });
    }

    const withClientScore = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelVersion: "demo-v1", actionIds: [], officialScore: 90 }),
    });
    const strictResult = await readJsonRequest(withClientScore, planInputSchema);
    expect(strictResult.ok).toBe(false);
    if (!strictResult.ok) expect(strictResult.response.status).toBe(400);
  });
});
