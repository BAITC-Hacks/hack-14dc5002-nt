import { explainPlan } from "@/lib/server/explanation";
import { organizerPost } from "@/lib/server/organizer-http";
import { organizerExplainSchema } from "@/lib/server/organizer-request-schemas";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return organizerPost(request, organizerExplainSchema, (input) => explainPlan(input, request));
}
