import type {
  EventPreviewInput, EventConfirmInput, InvalidSimulation, PlanInput, PlanSelection,
  ReplacementOption, Comparison, ValidSimulation,
} from "../../contracts/index.ts";

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
