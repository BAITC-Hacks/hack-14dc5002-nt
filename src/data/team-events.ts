import type { TeamCancellationEvent, TeamOpportunityEvent } from "../lib/simulation/event-types.ts";

/** Mandatory catalog action; no new costs/effects and no change to the organizer dataset. */
export const REQUIRED_ACTION_EVENT: Readonly<Omit<TeamOpportunityEvent, "requiredActionId" | "modelVersion">> = Object.freeze({
  id: "require-action",
  version: "team-events-v3",
  kind: "opportunity",
  source: "team-scenario",
  title: "Обязательное мероприятие из каталога",
  refundPolicy: "full-before-start",
  maxRecommendations: 3,
  disclaimer: "Сценарий команды: выбранная мера каталога должна войти в пятёрку вместо одной прежней. Замена до начала исполнения, бюджет и ограничения сохраняются.",
});

/** General cancellation rule; target and replacement IDs are resolved from the current catalog. */
export const ACTION_CANCELLATION_EVENT: Readonly<Omit<TeamCancellationEvent, "cancelledActionId" | "replacementActionIds">> = Object.freeze({
  id: "cancel-action",
  version: "team-events-v2",
  modelVersion: "organizer-v1",
  kind: "cancellation",
  source: "team-scenario",
  title: "Отмена выбранного мероприятия",
  refundPolicy: "full-before-start",
  maxRecommendations: 3,
  disclaimer: "Сценарий команды: отмена выбранной меры до начала исполнения, полный возврат стоимости, отменённая мера недоступна в новой ветви. Это не событие из исходного датасета организатора.",
});

/** Approved team scenario, NOT part of the organizer's original dataset. */
export const SCHOOL_CANCELLATION_EVENT: TeamCancellationEvent = Object.freeze({
  id: "cancel-m7",
  version: "team-events-v1",
  modelVersion: "organizer-v1",
  kind: "cancellation",
  source: "team-scenario",
  title: "Отмена строительства школы и детсада M7",
  cancelledActionId: "M7",
  refundPolicy: "full-before-start",
  replacementActionIds: Object.freeze([
    "M1", "M2", "M3", "M4", "M5", "M6", "M8", "M9", "M10", "M11", "M12", "M13", "M14",
  ]),
  maxRecommendations: 3,
  disclaimer: "Сценарий команды: отмена до начала исполнения, полный возврат стоимости, M7 недоступна в новой ветви. Это не событие из исходного датасета организатора.",
});
