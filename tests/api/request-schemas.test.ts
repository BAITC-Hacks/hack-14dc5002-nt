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

  it("accepts editor counts and duplicates for domain validation, but limits the input size", () => {
    for (const count of [0, 4, 5, 6, 30]) {
      expect(planInputSchema.safeParse({ ...plan, actionIds: Array(count).fill("a") }).success).toBe(true);
    }
    expect(planInputSchema.safeParse({ ...plan, actionIds: Array(31).fill("a") }).success).toBe(false);
  });

  it.each([
    null,
    [],
    { ...plan, modelVersion: " " },
    { ...plan, modelVersion: "v".repeat(65) },
    { ...plan, actionIds: "a" },
    { ...plan, actionIds: [123] },
    { ...plan, actionIds: [""] },
    { ...plan, actionIds: ["a".repeat(129)] },
    { ...plan, eventId: "event-injected-into-base" },
  ])("rejects malformed plan input %#", (input) => {
    expect(planInputSchema.safeParse(input).success).toBe(false);
  });

  it("trims identifiers without modifying the caller's object", () => {
    const input = { modelVersion: " demo-v1 ", actionIds: [" action "] };
    expect(planInputSchema.parse(input)).toEqual({ modelVersion: "demo-v1", actionIds: ["action"] });
    expect(input).toEqual({ modelVersion: " demo-v1 ", actionIds: [" action "] });
  });

  it("rejects forged nested results and missing swap IDs", () => {
    const preview = { basePlan: plan, eventId: "event" };
    const confirm = { ...preview, removedActionId: "old", addedActionId: "new" };
    expect(eventPreviewInputSchema.safeParse({ ...preview, basePlan: { ...plan, totalCost: 0 } }).success).toBe(false);
    expect(eventConfirmInputSchema.safeParse(preview).success).toBe(false);
    expect(eventConfirmInputSchema.safeParse({ ...confirm, addedActionId: " " }).success).toBe(false);
    expect(explainInputSchema.safeParse({ kind: "unknown", plan }).success).toBe(false);
    expect(explainInputSchema.safeParse({ kind: "event", change: { ...confirm, officialScore: 100 } }).success).toBe(false);
    expect(explainInputSchema.safeParse({ kind: "event", change: confirm }).success).toBe(true);
  });
});
