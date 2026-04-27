import { z } from 'zod/v4';
import type {
    EntityCommandInvocation,
    EntityFormInvocation,
    EntityQueryInvocation,
    EntityRemoteResult
} from '../../daemon/protocol/entityRemote.js';
import type { MissionDaemonService } from '../../daemon/runtime/mission/MissionDaemonService.js';
import {
    entityChannelSchema,
    entityIdSchema
} from './Entity.js';

export const entityNameSchema = z.string().trim().min(1);
export const entityMethodSchema = z.string().trim().min(1);

export const entityCommandInputOptionSchema = z.object({
    optionId: z.string().trim().min(1),
    label: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    disabled: z.boolean().optional(),
    disabledReason: z.string().trim().min(1).optional()
}).strict();

export const entityCommandInputDescriptorSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('text'),
        label: z.string().trim().min(1).optional(),
        placeholder: z.string().optional(),
        required: z.boolean().optional(),
        multiline: z.boolean().optional()
    }).strict(),
    z.object({
        kind: z.literal('selection'),
        label: z.string().trim().min(1).optional(),
        required: z.boolean().optional(),
        multiple: z.boolean().optional(),
        options: z.array(entityCommandInputOptionSchema).min(1)
    }).strict(),
    z.object({
        kind: z.literal('boolean'),
        label: z.string().trim().min(1).optional(),
        defaultValue: z.boolean().optional()
    }).strict(),
    z.object({
        kind: z.literal('number'),
        label: z.string().trim().min(1).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().positive().optional(),
        defaultValue: z.number().optional()
    }).strict()
]);

export const entityCommandConfirmationSchema = z.object({
    required: z.boolean(),
    prompt: z.string().trim().min(1).optional()
}).strict();

export const entityCommandDescriptorSchema = z.object({
    commandId: z.string().trim().min(1),
    label: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    disabled: z.boolean(),
    disabledReason: z.string().trim().min(1).optional(),
    variant: z.enum(['default', 'destructive']).optional(),
    iconHint: z.string().trim().min(1).optional(),
    confirmation: entityCommandConfirmationSchema.optional(),
    input: entityCommandInputDescriptorSchema.optional(),
    presentationOrder: z.number().int().optional()
}).strict();

export const entityCommandAcknowledgementSchema = z.object({
    ok: z.literal(true),
    entity: entityNameSchema,
    method: entityMethodSchema,
    id: z.string().trim().min(1).optional()
}).strict();

const nonEmptyStringSchema = z.string().trim().min(1);

export const entityEventEnvelopeSchema = z.object({
    eventId: nonEmptyStringSchema,
    entityId: entityIdSchema,
    channel: entityChannelSchema,
    eventName: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    occurredAt: nonEmptyStringSchema,
    missionId: nonEmptyStringSchema.optional(),
    payload: z.unknown()
}).strict();

export type EntityCommandInputOption = z.infer<typeof entityCommandInputOptionSchema>;
export type EntityCommandInputDescriptor = z.infer<typeof entityCommandInputDescriptorSchema>;
export type EntityCommandConfirmation = z.infer<typeof entityCommandConfirmationSchema>;
export type EntityCommandDescriptor = z.infer<typeof entityCommandDescriptorSchema>;
export type EntityCommandAcknowledgement = z.infer<typeof entityCommandAcknowledgementSchema>;
export type EntityEventEnvelope = z.infer<typeof entityEventEnvelopeSchema>;

export type EntityContractContext = {
    surfacePath: string;
    authToken?: string;
    missionService?: MissionDaemonService;
};

export type EntityMethodContract = {
    payload: z.ZodType;
    result: z.ZodType;
    execute(payload: any, context: EntityContractContext): Promise<unknown> | unknown;
};

export type EntityContract = {
    entity: string;
    queries: Record<string, EntityMethodContract>;
    commands: Record<string, EntityMethodContract>;
};

export async function executeEntityContractQuery(
    contract: EntityContract,
    input: EntityQueryInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    return executeEntityContractMethod('Query', contract.queries, input, context);
}

export async function executeEntityContractCommand(
    contract: EntityContract,
    input: EntityCommandInvocation | EntityFormInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    return executeEntityContractMethod('Command', contract.commands, input, context);
}

async function executeEntityContractMethod(
    kind: 'Query' | 'Command',
    methods: Record<string, EntityMethodContract>,
    input: EntityQueryInvocation | EntityCommandInvocation | EntityFormInvocation,
    context: EntityContractContext
): Promise<EntityRemoteResult> {
    const method = methods[input.method];
    if (!method) {
        throw new Error(`${kind} method '${input.entity}.${input.method}' is not implemented in the daemon.`);
    }

    const payload = method.payload.parse(input.payload ?? {});
    return method.result.parse(await method.execute(payload, context));
}
