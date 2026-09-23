import type {
  ApiResponse,
  Catalog,
  EventConfirmInput,
  EventConfirmResult,
  EventPreviewInput,
  EventPreviewResult,
  ExplainInput,
  Explanation,
  PlanInput,
  SimulationResult,
} from "@/contracts";
import requests from "@/mocks/requests.json";
import catalogFixture from "@/mocks/catalog.json";
import simulateValidFixture from "@/mocks/simulate.valid.json";
import simulateFourFixture from "@/mocks/simulate.invalid-four.json";
import simulateSixFixture from "@/mocks/simulate.invalid-six.json";
import eventPreviewFixture from "@/mocks/event.preview.json";
import eventConfirmFixture from "@/mocks/event.confirm.json";
import opportunityPreviewFixture from "@/mocks/opportunity.preview.json";
import opportunityConfirmFixture from "@/mocks/opportunity.confirm.json";
import explainFixture from "@/mocks/explain.template.json";

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const normalizeIds = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b));
const sameIds = (a: string[], b: string[]) => JSON.stringify(normalizeIds(a)) === JSON.stringify(normalizeIds(b));
const samePlan = (a: PlanInput, b: PlanInput) => a.modelVersion === b.modelVersion && sameIds(a.actionIds, b.actionIds);
const error = <T>(code: string, message: string): ApiResponse<T> => ({ ok: false, error: { code, message } });

async function request<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await response.json() as ApiResponse<T>;
  } catch {
    return error("NETWORK_ERROR", "Не удалось связаться с сервером.");
  }
}

function mockScenario<T>(supported: boolean, fixture: ApiResponse<T>): ApiResponse<T> {
  return supported ? structuredClone(fixture) : error("MOCK_SCENARIO_NOT_DEFINED", "Для этого запроса нет mock-сценария.");
}

export async function getCatalog(): Promise<ApiResponse<Catalog>> {
  if (!isMock) {
    const result = await request<Catalog>("/api/catalog");
    if (result.ok && result.data.config.modelVersion !== catalogFixture.data.config.modelVersion) {
      return error("UI_CONTRACT_OUTDATED", "Для новой модели нужен интерфейс с выбором районов. Подключите organizer-api; старое демо доступно в mock-режиме.");
    }
    return result;
  }
  return structuredClone(catalogFixture) as ApiResponse<Catalog>;
}

export async function simulate(plan: PlanInput): Promise<ApiResponse<SimulationResult>> {
  if (!isMock) return request<SimulationResult>("/api/simulate", plan);
  const scenarios = [
    [requests.simulateValid, simulateValidFixture],
    [requests.simulateInvalidFour, simulateFourFixture],
    [requests.simulateInvalidSix, simulateSixFixture],
  ] as const;
  const match = scenarios.find(([expected]) => samePlan(plan, expected));
  return match
    ? structuredClone(match[1]) as unknown as ApiResponse<SimulationResult>
    : error("MOCK_SCENARIO_NOT_DEFINED", "Для этого плана нет mock-сценария.");
}

export async function previewEvent(input: EventPreviewInput): Promise<ApiResponse<EventPreviewResult>> {
  if (!isMock) return request<EventPreviewResult>("/api/events/preview", input);
  const scenarios = [
    [requests.eventPreview, eventPreviewFixture],
    [requests.opportunityPreview, opportunityPreviewFixture],
  ] as const;
  const match = scenarios.find(([expected]) => expected.eventId === input.eventId && samePlan(input.basePlan, expected.basePlan));
  return match ? structuredClone(match[1]) as unknown as ApiResponse<EventPreviewResult> : error("MOCK_SCENARIO_NOT_DEFINED", "Для этого события и плана нет mock-сценария.");
}

export async function confirmEvent(input: EventConfirmInput): Promise<ApiResponse<EventConfirmResult>> {
  if (!isMock) return request<EventConfirmResult>("/api/events/confirm", input);
  const scenarios = [
    [requests.eventConfirm, eventConfirmFixture],
    [requests.opportunityConfirm, opportunityConfirmFixture],
  ] as const;
  const match = scenarios.find(([expected]) => expected.eventId === input.eventId
    && expected.removedActionId === input.removedActionId
    && expected.addedActionId === input.addedActionId
    && samePlan(input.basePlan, expected.basePlan));
  return match ? structuredClone(match[1]) as unknown as ApiResponse<EventConfirmResult> : error("MOCK_SCENARIO_NOT_DEFINED", "Для этой замены нет mock-сценария.");
}

export async function explain(input: ExplainInput): Promise<ApiResponse<Explanation>> {
  if (!isMock) return request<Explanation>("/api/explain", input);
  const expectedEvent = requests.explainEvent.change;
  const isKnownEvent = input.kind === "event"
    && input.change.eventId === expectedEvent.eventId
    && input.change.removedActionId === expectedEvent.removedActionId
    && input.change.addedActionId === expectedEvent.addedActionId
    && samePlan(input.change.basePlan, expectedEvent.basePlan);
  const confirmsFixture = isKnownEvent && requests.eventConfirm.eventId === input.change.eventId
    && requests.eventConfirm.removedActionId === input.change.removedActionId
    && requests.eventConfirm.addedActionId === input.change.addedActionId
    && samePlan(requests.eventConfirm.basePlan, input.change.basePlan);
  return mockScenario(confirmsFixture, explainFixture as unknown as ApiResponse<Explanation>);
}
