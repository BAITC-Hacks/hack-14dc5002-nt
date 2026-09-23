import { simulatePlan } from "@/lib/simulation";
import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";
import { organizerPlanSchema } from "@/lib/server/organizer-request-schemas";
import { assertCurrentModel, organizerPost } from "@/lib/server/organizer-http";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return organizerPost(request, organizerPlanSchema, (plan) => {
    assertCurrentModel(plan);
    return simulatePlan(plan, getOrganizerCatalog());
  });
}
