import { z } from 'zod/v4';
import { entityMethodSchema, entityNameSchema } from '../../entities/Entity/EntitySchema.js';

export const entityQueryInvocationSchema = z.object({
    entity: entityNameSchema,
    method: entityMethodSchema,
    payload: z.unknown().optional()
}).strict();

export const entityCommandInvocationSchema = z.object({
    entity: entityNameSchema,
    method: entityMethodSchema,
    payload: z.unknown().optional()
}).strict();

export const entityFormInvocationSchema = entityCommandInvocationSchema;

export type EntityQueryInvocation = z.infer<typeof entityQueryInvocationSchema>;
export type EntityCommandInvocation = z.infer<typeof entityCommandInvocationSchema>;
export type EntityFormInvocation = z.infer<typeof entityFormInvocationSchema>;
export type EntityRemoteResult = unknown;
