import { organizerPost } from "@/lib/server/organizer-http";
import { organizerConfirmSchema } from "@/lib/server/organizer-request-schemas";
import { confirmOrganizerEvent } from "@/lib/server/organizer-events";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return organizerPost(request, organizerConfirmSchema, confirmOrganizerEvent);
}
