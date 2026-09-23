import { getOrganizerCatalog } from "@/lib/server/organizer-catalog";

export function GET(): Response {
  return Response.json({ ok: true, data: getOrganizerCatalog() });
}
