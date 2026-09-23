import type { z } from "zod";
import type { PlanInput } from "@/contracts/organizer";
import { DomainError } from "@/lib/simulation";
import { readJsonRequest } from "./read-json-request";
import { getOrganizerCatalog } from "./organizer-catalog";

export function assertCurrentModel(plan: PlanInput): void {
  if (plan.modelVersion !== getOrganizerCatalog().config.modelVersion) {
    throw new DomainError("MODEL_VERSION_MISMATCH", "Обновите каталог: версия модели изменилась.");
  }
}

export function domainResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    const status = ["MODEL_VERSION_MISMATCH", "EVENT_VERSION_MISMATCH", "EVENT_MODEL_MISMATCH"].includes(error.code) ? 409 : 422;
    return Response.json({ ok: false, error: { code: error.code, message: error.message, issues: error.issues } }, { status });
  }
  return Response.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Не удалось выполнить запрос." } }, { status: 500 });
}

export async function organizerPost<S extends z.ZodType>(
  request: Request, schema: S, execute: (input: z.output<S>) => unknown | Promise<unknown>,
): Promise<Response> {
  try {
    const parsed = await readJsonRequest(request, schema);
    if (!parsed.ok) return parsed.response;
    return Response.json({ ok: true, data: await execute(parsed.data) });
  } catch (error) {
    return domainResponse(error);
  }
}
