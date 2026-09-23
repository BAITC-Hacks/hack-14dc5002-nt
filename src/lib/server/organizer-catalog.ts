import rawCatalog from "@/data/organizer-catalog.json";
import type { Catalog } from "@/contracts/organizer-api";
import type { Catalog as EngineCatalog } from "@/contracts/organizer";
import { ACTION_CANCELLATION_EVENT, REQUIRED_ACTION_EVENT, SCHOOL_CANCELLATION_EVENT } from "@/data/team-events";
import { validatePlan } from "@/lib/simulation";

// Only the trusted checked-in JSON is cast. Requests can never provide a catalog.
const catalog = rawCatalog as unknown as EngineCatalog;
const issues = validatePlan(catalog.demoPlan, catalog);
if (issues.length) throw new Error("Invalid organizer catalog or demo plan");

export function getOrganizerCatalog(): Catalog {
  // Do not allow a consumer to mutate authoritative prices/effects across requests.
  return structuredClone({
    ...catalog,
    teamEvents: [ACTION_CANCELLATION_EVENT, SCHOOL_CANCELLATION_EVENT, REQUIRED_ACTION_EVENT].map((event) => ({
      id: event.id as "cancel-action" | "cancel-m7" | "require-action",
      version: event.version,
      modelVersion: catalog.config.modelVersion,
      kind: event.kind,
      source: event.source,
      title: event.title,
      disclaimer: event.disclaimer,
    })),
  });
}
