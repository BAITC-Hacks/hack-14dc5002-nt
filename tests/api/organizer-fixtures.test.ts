import { expect, it } from "vitest";
import scenarios from "@/mocks/organizer/scenarios.json";
import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";
import { simulatePlan } from "@/lib/simulation";
import { previewOrganizerEvent, confirmOrganizerEvent } from "@/lib/server/organizer-events";
import { organizerPlanSchema, organizerPreviewSchema, organizerConfirmSchema, organizerExplainSchema } from "@/lib/server/organizer-request-schemas";
import { buildExplanation } from "@/lib/server/explanation-templates";

it("all 47 organizer fixtures reproduce the authoritative engine and localized templates", () => {
  expect(scenarios).toHaveLength(47);
  const catalog = getOrganizerCatalog();
  for (const scenario of scenarios) {
    let expected: unknown;
    switch (scenario.operation) {
      case "catalog": expected = catalog; break;
      case "simulate": expected = simulatePlan(organizerPlanSchema.parse(scenario.input), catalog); break;
      case "preview": expected = previewOrganizerEvent(organizerPreviewSchema.parse(scenario.input)); break;
      case "confirm": expected = confirmOrganizerEvent(organizerConfirmSchema.parse(scenario.input)); break;
      case "explain": {
        const input = organizerExplainSchema.parse(scenario.input);
        if (input.kind === "base") {
          const result = simulatePlan(input.plan, catalog);
          if (!result.valid) throw new Error("Invalid explanation fixture");
          expected = buildExplanation({ catalog, result }, input.language).template;
        } else {
          const { base, branch, comparison } = confirmOrganizerEvent(input.change);
          expected = buildExplanation({ catalog, result: branch, base, comparison, change: input.change }, input.language).template;
        }
        break;
      }
      default: throw new Error("Unknown fixture operation");
    }
    expect(scenario.response).toEqual({ ok: true, data: expected });
  }
});
