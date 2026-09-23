/** Shared contract v1. Only participant 3 may change this file after team agreement.
 * This is a proposed hackathon model, NOT an official Astana scoring standard.
 * All indicators are normalized: larger values mean better outcomes.
 */
export const DIRECTIONS = [
  "transport", "green", "social", "safety", "services",
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type Metrics = Record<Direction, number>;
export type Effects = Record<string, Partial<Metrics>>;

export interface District {
  id: string;
  name: string;
  weight: number;
  baseline: Metrics;
}
export interface Action {
  id: string;
  title: string;
  description: string;
  direction: Direction;
  cost: number;
  lagMonths: number;
  effects: Effects;
  constraints: { requires: string[]; excludes: string[] };
  availability: { kind: "always" } | { kind: "event"; eventId: string };
}
export type CityEvent = {
  id: string;
  title: string;
  description: string;
} & (
  | { kind: "cancellation"; blockedActionId: string }
  | { kind: "opportunity"; unlockedActionId: string }
);
export interface ModelConfig {
  modelVersion: string;
  budgetLimit: number;
  decisionsRequired: number;
  horizonMonths: number;
  lagRule: "step";
  dimensionWeights: Metrics;
  dataMode: "synthetic" | "organizer";
  disclaimer: string;
}
export interface PlanInput {
  modelVersion: string;
  actionIds: string[];
}
export interface Catalog {
  config: ModelConfig;
  districts: District[];
  actions: Action[];
  events: CityEvent[];
  demoPlan: PlanInput;
}
export interface ValidationIssue {
  code: string;
  message: string;
  actionIds: string[];
}
export interface DistrictResult {
  districtId: string;
  before: Metrics;
  after: Metrics;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
}
export interface ActionTrace {
  actionId: string;
  active: boolean;
  lagMonths: number;
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
    dimensions: Metrics;
    districts: DistrictResult[];
    baselineOfficialScore: number;
    deltaFromBaseline: number;
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
  dimensionsDelta: Metrics;
  districts: {
    districtId: string;
    scoreDelta: number;
    dimensionsDelta: Metrics;
  }[];
}
export interface ReplacementOption {
  removedActionId: string;
  addedActionId: string;
  plan: PlanInput;
  result: ValidSimulation;
  comparison: Comparison;
}
export interface EventPreviewInput {
  basePlan: PlanInput;
  eventId: string;
}
export interface EventPreviewResult {
  base: ValidSimulation;
  event: CityEvent;
  draft: PlanInput;
  draftResult: SimulationResult;
  requiresReplacement: true;
  replacementOptions: ReplacementOption[];
}
export interface EventConfirmInput extends EventPreviewInput {
  removedActionId: string;
  addedActionId: string;
}
export interface EventConfirmResult {
  base: ValidSimulation;
  event: CityEvent;
  branch: ValidSimulation;
  comparison: Comparison;
}
export type ExplainInput =
  | { kind: "base"; plan: PlanInput }
  | { kind: "event"; change: EventConfirmInput };
export interface Explanation {
  source: "ai" | "template";
  summary: string;
  observations: {
    actionIds: string[];
    districtIds: string[];
    text: string;
  }[];
  tradeoff: string;
  limitation: string;
}
export type ApiResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; message: string; issues?: ValidationIssue[] };
    };
