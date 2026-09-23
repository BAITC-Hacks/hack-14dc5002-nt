import type { PlanInput } from "@/contracts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Only IDs and the version may cross the storage boundary; saved scores are ignored.
export function readStoredPlan(value: unknown): PlanInput | null {
  if (!record(value) || !record(value.plan)) return null;
  const { modelVersion, actionIds } = value.plan;
  if (typeof modelVersion !== "string" || !modelVersion.trim()
    || value.modelVersion !== modelVersion || !Array.isArray(actionIds)
    || actionIds.length > 30
    || !actionIds.every((id): id is string => typeof id === "string" && id.trim().length > 0)
    || new Set(actionIds).size !== actionIds.length) return null;
  return { modelVersion, actionIds: [...actionIds] };
}
