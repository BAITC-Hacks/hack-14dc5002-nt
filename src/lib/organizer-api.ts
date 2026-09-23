/** Client for organizer-v1. No server imports or API secrets may enter this module. */
import type {
  ApiResponse, Catalog, EventConfirmInput, EventConfirmResult, EventPreviewInput,
  EventPreviewResult, ExplainInput, Explanation, PlanInput, SimulationResult,
} from "@/contracts/organizer-api";
import fixtures from "@/mocks/organizer/scenarios.json";

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const failure = <T>(code: string, message: string): ApiResponse<T> => ({ ok: false, error: { code, message } });
function canonical(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) {
    const entries = value.map((item) => canonical(item));
    return key === "selections" ? entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : entries;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => [name, canonical(item, name)]));
  }
  return value;
}
function mock<T>(operation: string, input: unknown): ApiResponse<T> {
  const expected = JSON.stringify(canonical(input));
  const match = fixtures.find((fixture) => fixture.operation === operation && JSON.stringify(canonical(fixture.input)) === expected);
  return match ? structuredClone(match.response) as ApiResponse<T>
    : failure("MOCK_SCENARIO_NOT_DEFINED", "Для этого запроса нет organizer mock-сценария.");
}
async function http<T>(path: string, input?: unknown, signal?: AbortSignal): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: input === undefined ? "GET" : "POST",
      headers: input === undefined ? undefined : { "Content-Type": "application/json" },
      body: input === undefined ? undefined : JSON.stringify(input), signal,
    });
    const body = await response.json();
    if (!body || typeof body.ok !== "boolean" || (body.ok
      ? (!response.ok || !body.data || typeof body.data !== "object" || Array.isArray(body.data))
      : (typeof body.error?.code !== "string" || typeof body.error?.message !== "string"))) {
      return failure("INVALID_RESPONSE", "Сервер вернул ответ неизвестного формата.");
    }
    return body as ApiResponse<T>;
  } catch {
    return failure(signal?.aborted ? "REQUEST_ABORTED" : "NETWORK_ERROR", "Запрос не выполнен.");
  }
}
export const getCatalog = (signal?: AbortSignal): Promise<ApiResponse<Catalog>> => isMock
  ? Promise.resolve(mock("catalog", null)) : http("/api/catalog", undefined, signal);
export const simulate = (input: PlanInput, signal?: AbortSignal): Promise<ApiResponse<SimulationResult>> => isMock
  ? Promise.resolve(mock("simulate", input)) : http("/api/simulate", input, signal);
export const previewEvent = (input: EventPreviewInput, signal?: AbortSignal): Promise<ApiResponse<EventPreviewResult>> => isMock
  ? Promise.resolve(mock("preview", input)) : http("/api/events/preview", input, signal);
export const confirmEvent = (input: EventConfirmInput, signal?: AbortSignal): Promise<ApiResponse<EventConfirmResult>> => isMock
  ? Promise.resolve(mock("confirm", input)) : http("/api/events/confirm", input, signal);
export const explain = (input: ExplainInput, signal?: AbortSignal): Promise<ApiResponse<Explanation>> => isMock
  ? Promise.resolve(mock("explain", { ...input, language: input.language ?? "ru" })) : http("/api/explain", input, signal);
