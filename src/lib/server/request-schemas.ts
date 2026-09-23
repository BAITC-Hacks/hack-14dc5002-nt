import { z } from "zod";

const identifier = z.string().trim().min(1).max(128);

export const planInputSchema = z.object({
  modelVersion: z.string().trim().min(1).max(64),
  actionIds: z.array(identifier).max(30),
}).strict();

export const eventPreviewInputSchema = z.object({
  basePlan: planInputSchema,
  eventId: identifier,
}).strict();

export const eventConfirmInputSchema = eventPreviewInputSchema.extend({
  removedActionId: identifier,
  addedActionId: identifier,
}).strict();

export const explainInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("base"), plan: planInputSchema }).strict(),
  z.object({ kind: z.literal("event"), change: eventConfirmInputSchema }).strict(),
]);
