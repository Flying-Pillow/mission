import { z } from 'zod/v4';

const nonEmptyStringSchema = z.string().trim().min(1);

export const entityTableSchema = z.string().trim().min(1).regex(/^[a-z][a-z0-9_]*$/);
export const entityNameSchema = nonEmptyStringSchema;
export const entityMethodNameSchema = nonEmptyStringSchema;
export const entityObjectSchema = z.record(z.string(), z.unknown());

export const entityIdSchema = nonEmptyStringSchema.refine((value) => {
    const separatorIndex = value.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
        return false;
    }
    return entityTableSchema.safeParse(value.slice(0, separatorIndex)).success;
}, {
    message: 'Entity ids must use the table:uniqueId shape.'
});

export const entityChannelSchema = nonEmptyStringSchema.refine((value) => {
    const tableSeparatorIndex = value.indexOf(':');
    const eventSeparatorIndex = value.lastIndexOf('.');
    if (tableSeparatorIndex <= 0 || tableSeparatorIndex === value.length - 1) {
        return false;
    }
    if (eventSeparatorIndex <= tableSeparatorIndex + 1 || eventSeparatorIndex === value.length - 1) {
        return false;
    }
    return entityTableSchema.safeParse(value.slice(0, tableSeparatorIndex)).success;
}, {
    message: 'Entity channels must use the table:uniqueId.event shape.'
});

export const entityEventAddressSchema = z.object({
    entityId: entityIdSchema,
    channel: entityChannelSchema,
    eventName: nonEmptyStringSchema
}).strict();

const zodSchema = z.custom<z.ZodType>();

const entityClassSchema = z.custom<Function>((value) =>
    typeof value === 'function'
    && typeof (value as { prototype?: unknown }).prototype === 'object'
);

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

export const entityMethodUiSchema = z.object({
    label: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    variant: z.enum(['default', 'destructive']).optional(),
    iconHint: z.string().trim().min(1).optional(),
    confirmation: entityCommandConfirmationSchema.optional(),
    input: entityCommandInputDescriptorSchema.optional(),
    presentationOrder: z.number().int().optional()
}).strict();

export const entityMethodExecutionSchema = z.enum(['class', 'entity']);
export const entityMethodKindSchema = z.enum(['query', 'mutation']);

export const entityPropertySchema = z.object({
    schema: zodSchema,
    readonly: z.boolean().optional()
}).strict();

export const entityEventSchema = z.object({
    payload: zodSchema
}).strict();

export const entityMethodSchema = z.object({
    kind: entityMethodKindSchema,
    payload: zodSchema,
    result: zodSchema,
    execution: entityMethodExecutionSchema,
    ui: entityMethodUiSchema.optional()
}).strict();

export const entitySchema = z.object({
    entity: entityNameSchema,
    entityClass: entityClassSchema,
    properties: z.record(z.string(), entityPropertySchema).optional(),
    methods: z.record(z.string(), entityMethodSchema),
    events: z.record(z.string(), entityEventSchema).optional()
}).strict();

export const entityCommandAcknowledgementSchema = z.object({
    ok: z.literal(true),
    entity: entityNameSchema,
    method: entityMethodNameSchema,
    id: z.string().trim().min(1).optional()
}).strict();

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

export type EntityId = z.infer<typeof entityIdSchema>;
export type EntityChannel = z.infer<typeof entityChannelSchema>;
export type EntityEventAddress = z.infer<typeof entityEventAddressSchema>;
export type EntityCommandInputOption = z.infer<typeof entityCommandInputOptionSchema>;
export type EntityCommandInputDescriptor = z.infer<typeof entityCommandInputDescriptorSchema>;
export type EntityCommandConfirmation = z.infer<typeof entityCommandConfirmationSchema>;
export type EntityCommandDescriptor = z.infer<typeof entityCommandDescriptorSchema>;
export type EntityMethodUi = z.infer<typeof entityMethodUiSchema>;
export type EntityMethodExecution = z.infer<typeof entityMethodExecutionSchema>;
export type EntityMethodKind = z.infer<typeof entityMethodKindSchema>;
export type EntityProperty = z.infer<typeof entityPropertySchema>;
export type EntityEvent = z.infer<typeof entityEventSchema>;
export type EntityMethod = z.infer<typeof entityMethodSchema>;
export type EntitySchema = z.infer<typeof entitySchema>;
export type EntityCommandAcknowledgement = z.infer<typeof entityCommandAcknowledgementSchema>;
export type EntityEventEnvelope = z.infer<typeof entityEventEnvelopeSchema>;
