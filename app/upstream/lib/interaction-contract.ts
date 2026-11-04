import { z } from 'zod';

export const interactionContract = z.object({
  id: z.string().uuid(), at: z.string().datetime(),
  kind: z.enum(['risk-accepted', 'risk-task-created', 'focus-followed']),
  missionId: z.string().uuid().nullable(), sourceId: z.string().max(110),
  fingerprint: z.string().max(110), reason: z.string().min(8).max(500),
  taskId: z.string().max(64).nullable(),
  requestId: z.string().uuid(), requestFingerprint: z.string().max(110),
}).strict();
export type InteractionRecord = z.infer<typeof interactionContract>;
export const actionContract = z.discriminatedUnion('action', [
  z.object({ action: z.literal('risk-accept'), requestId: z.string().uuid(), sourceId: z.string().min(1).max(110), fingerprint: z.string().min(1).max(110), reason: z.string().trim().min(8).max(500), expectedUpdatedAt: z.string().datetime().nullable() }).strict(),
  z.object({ action: z.literal('risk-plan'), requestId: z.string().uuid(), sourceId: z.string().min(1).max(110), fingerprint: z.string().min(1).max(110), reason: z.string().trim().min(8).max(500), expectedUpdatedAt: z.string().datetime().nullable() }).strict(),
  z.object({ action: z.literal('focus-follow'), requestId: z.string().uuid(), missionId: z.string().uuid(), suggestionId: z.string().min(1).max(110), expectedUpdatedAt: z.string().datetime().nullable() }).strict(),
]);
export type IntelligenceAction = z.infer<typeof actionContract>;
