import type {
  EventPreviewInput, EventConfirmInput, InvalidSimulation, PlanInput, PlanSelection,
  ReplacementOption, Comparison, ValidSimulation,
} from "../../contracts/organizer.ts";

/** Engine-owned extension proposal; does not change the shared HTTP contract. */
export interface TeamCancellationEvent {
  readonly id: string;
  readonly version: string;
  readonly modelVersion: string;
  readonly kind: "cancellation";
  readonly source: "team-scenario";
  readonly title: string;
  readonly cancelledActionId: string;
  readonly refundPolicy: "full-before-start";
  readonly replacementActionIds: readonly string[];
  readonly maxRecommendations: number;
  readonly disclaimer: string;
}

export interface TeamEventPreviewInput extends EventPreviewInput {
  eventVersion: string;
  /** Required for cancel-action; cancel-m7 defaults to M7 for compatibility. */
  cancelledActionId?: string;
}

export interface TeamEventConfirmInput extends EventConfirmInput {
  eventVersion: string;
  /** The same cancellation target as in the preview, not a different removed action. */
  cancelledActionId?: string;
  /** Required for district replacements; forbidden for city replacements. */
  addedDistrictId?: string;
}

/** Prefer these stricter inputs when calling the general cancellation scenario. */
export interface ActionCancellationPreviewInput extends TeamEventPreviewInput {
  cancelledActionId: string;
}
export interface ActionCancellationConfirmInput extends TeamEventConfirmInput {
  cancelledActionId: string;
}

export interface TeamReplacementOption extends ReplacementOption {
  addedSelection: PlanSelection;
}

export interface TeamEventPreviewResult {
  base: ValidSimulation;
  event: TeamCancellationEvent;
  draft: PlanInput;
  draftResult: InvalidSimulation;
  refundAmount: number;
  availableBudget: number;
  requiresReplacement: true;
  replacementOptions: TeamReplacementOption[];
}

export interface TeamEventConfirmResult {
  base: ValidSimulation;
  event: TeamCancellationEvent;
  branch: ValidSimulation;
  comparison: Comparison;
}

/** A catalog action is mandatory; its parameters are never supplied by the request. */
export interface TeamOpportunityEvent {
  readonly id: "require-action";
  readonly version: string;
  readonly modelVersion: string;
  readonly kind: "opportunity";
  readonly source: "team-scenario";
  readonly title: string;
  readonly requiredActionId: string;
  readonly refundPolicy: "full-before-start";
  readonly maxRecommendations: number;
  readonly disclaimer: string;
}

export interface OpportunityPreviewInput extends EventPreviewInput {
  eventId: "require-action";
  eventVersion: string;
  requiredActionId: string;
}

export interface OpportunityConfirmInput extends OpportunityPreviewInput, Pick<EventConfirmInput, "removedActionId" | "addedActionId"> {
  addedDistrictId?: string;
}

export interface OpportunityReplacementOption extends TeamReplacementOption {
  refundAmount: number;
  /** Budget available after removing this option's old action, before adding the required one. */
  availableBudget: number;
}

interface OpportunityPreviewCommon {
  base: ValidSimulation;
  event: TeamOpportunityEvent;
}

export type OpportunityPreviewResult = OpportunityPreviewCommon & (
  | { status: "already-satisfied"; requiresReplacement: false; replacementOptions: [] }
  | { status: "replacement-required"; requiresReplacement: true; replacementOptions: OpportunityReplacementOption[] }
  | { status: "no-valid-replacement"; requiresReplacement: true; replacementOptions: [] }
);

export interface OpportunityConfirmResult {
  base: ValidSimulation;
  event: TeamOpportunityEvent;
  branch: ValidSimulation;
  comparison: Comparison;
}
