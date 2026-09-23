import type { TeamCancellationEvent } from "../lib/simulation/event-types.ts";

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
