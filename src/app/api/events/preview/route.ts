import { organizerPost } from "@/lib/server/organizer-http";
import { organizerPreviewSchema } from "@/lib/server/organizer-request-schemas";
import { previewOrganizerEvent } from "@/lib/server/organizer-events";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return organizerPost(request, organizerPreviewSchema, previewOrganizerEvent);
}
