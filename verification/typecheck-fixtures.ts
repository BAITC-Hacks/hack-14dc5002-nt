// Build-time shape checks for literal fixtures; no runtime or application dependency.
import type {
  ApiResponse, Catalog, SimulationResult, EventPreviewResult,
  EventConfirmResult, Explanation,
} from '../src/contracts/index';
// The generated companion file contains object literals so TypeScript checks
// discriminants and every nested field instead of widening JSON import strings.
export type FixtureChecks = {
  catalog: ApiResponse<Catalog>;
  valid: ApiResponse<SimulationResult>;
  invalidFour: ApiResponse<SimulationResult>;
  invalidSix: ApiResponse<SimulationResult>;
  eventPreview: ApiResponse<EventPreviewResult>;
  eventConfirm: ApiResponse<EventConfirmResult>;
  opportunityPreview: ApiResponse<EventPreviewResult>;
  opportunityConfirm: ApiResponse<EventConfirmResult>;
  explanation: ApiResponse<Explanation>;
};
