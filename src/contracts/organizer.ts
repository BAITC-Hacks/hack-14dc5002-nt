/** Contract for the organizer-provided synthetic hackathon dataset (model v2). */
export const DIRECTIONS = ["transport", "ecology", "social", "safety", "services"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const INDICATORS = ["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"] as const;
export type Indicator = (typeof INDICATORS)[number];
export type Metrics = Record<Indicator, number>;
export type Effects = Partial<Metrics>;

export interface District {
  id: string;
  name: string;
  populationWeight: number;
  baseline: Metrics;
}
export interface Action {
  id: string;
  title: string;
  description: string;
  direction: Direction;
  scope: "district" | "city";
  cost: number;
  lagQuarters: number;
  effects: Effects;
  constraints: { requires: string[] };
}
export interface ActionConflict {
  actionIds: [string, string];
  scope: "global" | "same-district";
}
export interface Synergy {
  actionIds: [string, string];
  indicator: Indicator;
  bonus: number;
  districtActionId: string;
}
export interface ModelConfig {
  modelVersion: string;
  budgetLimit: number;
  decisionsRequired: number;
  horizonQuarters: number;
  lagRule: "linear-remaining-horizon";
  indicatorWeights: Metrics;
  populationAverageWeight: number;
  weakestDistrictWeight: number;
  criticalThreshold: number;
  criticalPenalty: number;
  maxActionsPerDirection: number;
  dataMode: "organizer-synthetic";
  disclaimer: string;
}
export interface PlanSelection {
  actionId: string;
  districtId?: string;
}
export interface PlanInput {
  modelVersion: string;
  selections: PlanSelection[];
}
export interface Catalog {
  config: ModelConfig;
  districts: District[];
  actions: Action[];
  conflicts: ActionConflict[];
  synergies: Synergy[];
  events: [];
  demoPlan: PlanInput;
}
export interface ValidationIssue {
  code: string;
  message: string;
  actionIds: string[];
}
export interface DistrictResult {
  districtId: string;
  populationWeight: number;
  before: Metrics;
  after: Metrics;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  criticalCountBefore: number;
  criticalCountAfter: number;
}
export interface ActionTrace {
  actionId: string;
  districtId: string | null;
  lagQuarters: number;
  effectMultiplier: number;
  appliedEffects: Effects;
}
interface SimulationCommon {
  plan: PlanInput;
  totalCost: number;
  remainingBudget: number;
  warnings: string[];
}
export interface ValidSimulation extends SimulationCommon {
  valid: true;
  officialScore: number;
  errors: [];
  metrics: {
    indicators: Metrics;
    directions: Record<Direction, number>;
    districts: DistrictResult[];
    populationWeightedAverage: number;
    weakestDistrictScore: number;
    criticalCount: number;
    baselineOfficialScore: number;
    deltaFromBaseline: number;
    synergiesApplied: { actionIds: [string, string]; districtId: string; indicator: Indicator; bonus: number }[];
  };
  trace: ActionTrace[];
}
export interface InvalidSimulation extends SimulationCommon {
  valid: false;
  officialScore: null;
  errors: ValidationIssue[];
  metrics: null;
  trace: [];
}
export type SimulationResult = ValidSimulation | InvalidSimulation;
export interface Comparison {
  scoreDelta: number;
  indicatorsDelta: Metrics;
  districts: { districtId: string; scoreDelta: number; indicatorsDelta: Metrics }[];
}

// Events remain optional in the assignment; the supplied organizer dataset defines none.
export interface EventPreviewInput { basePlan: PlanInput; eventId: string; }
export interface EventConfirmInput extends EventPreviewInput { removedActionId: string; addedActionId: string; }
export interface ReplacementOption {
  removedActionId: string;
  addedActionId: string;
  plan: PlanInput;
  result: ValidSimulation;
  comparison: Comparison;
}
export interface EventPreviewResult {
  base: ValidSimulation;
  event: never;
  draft: PlanInput;
  draftResult: SimulationResult;
  requiresReplacement: true;
  replacementOptions: ReplacementOption[];
}
export interface EventConfirmResult {
  base: ValidSimulation;
  event: never;
  branch: ValidSimulation;
  comparison: Comparison;
}
export type ExplainInput = { kind: "base"; plan: PlanInput } | { kind: "event"; change: EventConfirmInput };
export interface Explanation {
  source: "ai" | "template";
  summary: string;
  observations: { actionIds: string[]; districtIds: string[]; text: string }[];
  tradeoff: string;
  limitation: string;
}
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; issues?: ValidationIssue[] } };
