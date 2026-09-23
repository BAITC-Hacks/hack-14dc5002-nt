import { describe, expect, it } from "vitest";
import {
  eventConfirmInputSchema,
  eventPreviewInputSchema,
  explainInputSchema,
  planInputSchema,
} from "@/lib/server/request-schemas";

const plan = { modelVersion: "demo-v1", actionIds: ["a", "b", "c", "d"] };

describe("strict API request schemas", () => {
  it("accepts syntactically valid plans so the engine can report decision-count errors", () => {
    expect(planInputSchema.safeParse(plan).success).toBe(true);
  });

  it("rejects client-supplied prices, effects, and scores", () => {
    expect(planInputSchema.safeParse({ ...plan, officialScore: 99 }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...plan, cost: 1 }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...plan, effects: {} }).success).toBe(false);
  });

  it("validates event and explanation request shapes strictly", () => {
    const preview = { basePlan: plan, eventId: "some-event" };
    const confirm = { ...preview, removedActionId: "old", addedActionId: "new" };

    expect(eventPreviewInputSchema.safeParse(preview).success).toBe(true);
    expect(eventConfirmInputSchema.safeParse(confirm).success).toBe(true);
    expect(explainInputSchema.safeParse({ kind: "base", plan }).success).toBe(true);
    expect(explainInputSchema.safeParse({ kind: "event", change: confirm, score: 50 }).success).toBe(false);
  });
});
