import { createHash, timingSafeEqual } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ExplainInput, Explanation } from "@/contracts/organizer-api";
import { DomainError, simulatePlan } from "@/lib/simulation";
import { confirmEvent } from "@/lib/simulation/events";
import { getOrganizerCatalog } from "./organizer-catalog";
import { assertCurrentModel } from "./organizer-http";
import { buildExplanation, type ExplanationContext } from "./explanation-templates";

const PROMPT_VERSION = "verified-facts-v2";
const CACHE_TTL_MS = 5 * 60_000;
const choiceSchema = z.object({ factIds: z.array(z.string().min(1).max(128)).min(2).max(5) }).strict();
// Process-local safeguards only: NOT a shared/serverless budget or global rate limiter.
const cache = new Map<string, { until: number; value: Explanation }>();
const running = new Set<string>();
let recentCalls: number[] = [];
let lifetimeCalls = 0;

function authorizedForAi(request: Request): boolean {
  // Explicit opt-in is only for a dev server bound to loopback (npm run dev:local).
  // A request URL/Host header is never treated as proof that the caller is local.
  if (process.env.NODE_ENV === "development" && process.env.AI_LOCAL_DEMO === "true") {
    const origin = request.headers.get("origin");
    const json = /^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "");
    const url = new URL(request.url);
    // Next's internal URL can use localhost while the browser opens 127.0.0.1.
    // Host is the browser's actual destination; Origin must match it exactly.
    const hostOrigin = request.headers.get("host") ? `${url.protocol}//${request.headers.get("host")}` : url.origin;
    // JSON forces browser preflight; reject foreign/simple Origin requests as well.
    if (json && (origin === null || origin === hostOrigin)) return true;
  }
  const secret = process.env.EXPLAIN_AI_ACCESS_TOKEN?.trim();
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function recalculate(input: ExplainInput): ExplanationContext {
  const catalog = getOrganizerCatalog();
  assertCurrentModel(input.kind === "base" ? input.plan : input.change.basePlan);
  if (input.kind === "base") {
    const result = simulatePlan(input.plan, catalog);
    if (!result.valid) throw new DomainError("INVALID_EXPLANATION_PLAN", "Объяснение доступно только для допустимого плана.", result.errors);
    return { catalog, result };
  }
  // Narrowing selects the engine overload, including the opt-in opportunity event.
  const confirmed = input.change.eventId === "require-action"
    ? confirmEvent(input.change, catalog) : confirmEvent(input.change, catalog);
  return { catalog, result: confirmed.branch, base: confirmed.base, comparison: confirmed.comparison, change: input.change };
}

/** Server route only. Paid calls need a token or explicitly enabled loopback development demo. */
export async function explainPlan(input: ExplainInput, request: Request): Promise<Explanation> {
  request.signal.throwIfAborted();
  const context = recalculate(input);
  const language = input.language ?? "ru";
  const { facts, template, aiLimitation } = buildExplanation(context, language);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim();
  if (process.env.AI_ENABLED !== "true" || !apiKey || !model || !authorizedForAi(request)) return template;

  // Full trusted context includes canonical selections, model/horizon/catalog, event/swap,
  // language and model; changed prices/effects also invalidate this optional cache.
  const key = createHash("sha256").update(JSON.stringify({
    prompt: PROMPT_VERSION, model, language, catalog: context.catalog,
    result: context.result, base: context.base, change: context.change && {
      ...context.change, basePlan: context.base!.plan,
    },
  })).digest("hex");
  const now = Date.now();
  for (const [id, entry] of cache) if (entry.until <= now) cache.delete(id);
  const cached = cache.get(key);
  if (cached) return structuredClone(cached.value);
  recentCalls = recentCalls.filter((time) => now - time < 60_000);
  if (running.has(key) || running.size >= 2 || recentCalls.length >= 6 || lifetimeCalls >= 100) return template;

  running.add(key);
  recentCalls.push(now);
  lifetimeCalls += 1;
  const controller = new AbortController();
  const configuredTimeout = Number(process.env.AI_TIMEOUT_MS ?? 12000);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.min(12000, Math.max(1000, configuredTimeout)) : 12000;
  const abort = () => controller.abort(request.signal.reason);
  request.signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("Explanation timeout")), timeoutMs);
  try {
    request.signal.throwIfAborted();
    const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
    const response = await client.responses.parse({
      model, store: false, max_output_tokens: 500,
      instructions: "Select 2 to 5 unique factIds from the provided verified facts, ordered by usefulness for understanding the computed plan. For an event choose at least 3: confirmed-swap first, then the added action and removed-action; use remaining slots for changes in districts or synergies versus the saved plan. Do not write prose, invent IDs, recalculate, or supply facts outside this list. The server renders the selected localized facts unchanged.",
      input: JSON.stringify({ language, summary: template.summary, facts }),
      text: { format: zodTextFormat(choiceSchema, "verified_explanation_facts") },
    }, { signal: controller.signal });
    request.signal.throwIfAborted();
    if (controller.signal.aborted || (response.output ?? []).some((item) =>
      item.type === "message" && item.content.some((content) => content.type === "refusal"))) return template;
    const choice = choiceSchema.safeParse(response.output_parsed);
    if (response.status !== "completed" || !choice.success) return template;
    const ids = choice.data.factIds;
    if (new Set(ids).size !== ids.length || ids.some((id) => !facts.some((fact) => fact.id === id))
      || (input.kind === "event" && (ids[0] !== "confirmed-swap"
        || !ids.includes(`action:${input.change.addedActionId}`)
        || !ids.includes(`removed-action:${input.change.removedActionId}`)))) return template;
    const value: Explanation = {
      ...template, source: "ai", limitation: aiLimitation,
      observations: ids.map((id) => {
        const { actionIds, districtIds, text } = facts.find((fact) => fact.id === id)!;
        return { actionIds: [...actionIds], districtIds: [...districtIds], text };
      }),
    };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + CACHE_TTL_MS, value: structuredClone(value) });
    return value;
  } catch {
    // No provider errors or credentials escape into responses or logs.
    request.signal.throwIfAborted();
    return template;
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
    running.delete(key);
  }
}
