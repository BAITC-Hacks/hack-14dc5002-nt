import type { EventConfirmInput, EventConfirmResult, EventPreviewInput, EventPreviewResult } from "@/contracts/organizer-api";
import { previewEvent, confirmEvent } from "@/lib/simulation/events";
import { getOrganizerCatalog } from "./organizer-catalog";
import { assertCurrentModel } from "./organizer-http";

export function previewOrganizerEvent(input: EventPreviewInput): EventPreviewResult {
  assertCurrentModel(input.basePlan);
  const catalog = getOrganizerCatalog();
  return input.eventId === "require-action" ? previewEvent(input, catalog) : previewEvent(input, catalog);
}

export function confirmOrganizerEvent(input: EventConfirmInput): EventConfirmResult {
  assertCurrentModel(input.basePlan);
  const catalog = getOrganizerCatalog();
  return input.eventId === "require-action" ? confirmEvent(input, catalog) : confirmEvent(input, catalog);
}
