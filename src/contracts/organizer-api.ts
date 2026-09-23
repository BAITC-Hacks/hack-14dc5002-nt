/** Live HTTP contract. Legacy demo-v1 UI types stay in index.ts during migration. */
export { DIRECTIONS, INDICATORS } from "./organizer";
export type {
  Action, ApiResponse, Comparison, Direction, District, Indicator, Metrics,
  PlanInput, PlanSelection, SimulationResult, ValidSimulation, ValidationIssue,
} from "./organizer";
import type { Catalog as EngineCatalog, Explanation as BaseExplanation, PlanInput } from "./organizer";
import type {
  TeamEventPreviewInput, TeamEventConfirmInput, TeamEventPreviewResult, TeamEventConfirmResult,
  OpportunityPreviewInput, OpportunityConfirmInput, OpportunityPreviewResult, OpportunityConfirmResult,
} from "../lib/simulation/event-types";

export type EventPreviewInput =
  | (TeamEventPreviewInput & { eventId: "cancel-action"; cancelledActionId: string })
  | (TeamEventPreviewInput & { eventId: "cancel-m7" })
  | OpportunityPreviewInput;
export type EventConfirmInput =
  | (TeamEventConfirmInput & { eventId: "cancel-action"; cancelledActionId: string })
  | (TeamEventConfirmInput & { eventId: "cancel-m7" })
  | OpportunityConfirmInput;
export type EventPreviewResult = TeamEventPreviewResult | OpportunityPreviewResult;
export type EventConfirmResult = TeamEventConfirmResult | OpportunityConfirmResult;
export type ReplacementOption = EventPreviewResult["replacementOptions"][number];
export interface TeamEventDescriptor {
  id: "cancel-action" | "cancel-m7" | "require-action";
  version: string;
  modelVersion: string;
  kind: "cancellation" | "opportunity";
  source: "team-scenario";
  title: string;
  disclaimer: string;
}
export interface Catalog extends EngineCatalog { teamEvents: TeamEventDescriptor[] }
export const LANGUAGES = ["ru", "kk", "en"] as const;
export type Language = typeof LANGUAGES[number];
export type ExplainInput = (
  | { kind: "base"; plan: PlanInput }
  | { kind: "event"; change: EventConfirmInput }
) & { language?: Language };
export interface Explanation extends BaseExplanation { language: Language }
