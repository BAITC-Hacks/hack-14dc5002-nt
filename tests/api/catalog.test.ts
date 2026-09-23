import { describe, expect, it } from "vitest";
import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";
import { GET } from "@/app/api/catalog/route";

describe("GET /api/catalog", () => {
  it("returns the shared catalog in the standard API envelope", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, data: getOrganizerCatalog() });
  });
});
