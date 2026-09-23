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
}

export interface TeamEventConfirmInput extends EventConfirmInput {
  eventVersion: string;
  /** Required for district replacements; forbidden for city replacements. */
  addedDistrictId?: string;
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
