import { z } from "zod";

const id = z.string().trim().min(1).max(128);
export const organizerPlanSchema = z.object({
  modelVersion: id,
  selections: z.array(z.object({ actionId: id, districtId: id.optional() }).strict()).max(30),
}).strict();

const common = { basePlan: organizerPlanSchema, eventVersion: id };
const cancellation = z.object({ ...common, eventId: z.literal("cancel-action"), cancelledActionId: id }).strict();
const school = z.object({ ...common, eventId: z.literal("cancel-m7"), cancelledActionId: id.optional() }).strict();
const opportunity = z.object({ ...common, eventId: z.literal("require-action"), requiredActionId: id }).strict();
export const organizerPreviewSchema = z.discriminatedUnion("eventId", [cancellation, school, opportunity]);
const swap = { removedActionId: id, addedActionId: id, addedDistrictId: id.optional() };
export const organizerConfirmSchema = z.discriminatedUnion("eventId", [
  cancellation.extend(swap).strict(), school.extend(swap).strict(), opportunity.extend(swap).strict(),
]);
const language = z.enum(["ru", "kk", "en"]).default("ru");
export const organizerExplainSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("base"), plan: organizerPlanSchema, language }).strict(),
  z.object({ kind: z.literal("event"), change: organizerConfirmSchema, language }).strict(),
]);
