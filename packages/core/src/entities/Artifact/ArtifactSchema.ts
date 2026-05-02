import { z } from 'zod/v4';
import {
    EntityCommandDescriptorSchema,
    EntityIdSchema
} from '../Entity/EntitySchema.js';

export const artifactEntityName = 'Artifact' as const;

export const ArtifactLocatorSchema = z.object({
    missionId: z.string().trim().min(1),
    repositoryRootPath: z.string().trim().min(1).optional(),
    artifactId: z.string().trim().min(1)
}).strict();

export const ArtifactEventSubjectSchema = ArtifactLocatorSchema.extend({
    entity: z.literal(artifactEntityName)
}).strict();

export const ArtifactBodySchema = z.object({
    mimeType: z.string().trim().min(1),
    content: z.string()
}).strict();

export const ArtifactWriteInputSchema = ArtifactLocatorSchema.extend({
    body: ArtifactBodySchema
}).strict();

export const ArtifactStorageSchema = z.object({
    id: EntityIdSchema,
    artifactId: z.string().trim().min(1),
    kind: z.enum(['mission', 'stage', 'task']),
    label: z.string().trim().min(1),
    fileName: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    key: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1).optional(),
    taskId: z.string().trim().min(1).optional(),
    filePath: z.string().trim().min(1).optional(),
    relativePath: z.string().trim().min(1).optional()
}).strict();

export const ArtifactDataSchema = z.object({
    ...ArtifactStorageSchema.shape,
    commands: z.array(EntityCommandDescriptorSchema).optional()
}).strict();

export const ArtifactBodySnapshotSchema = z.object({
    filePath: z.string().trim().min(1),
    body: ArtifactBodySchema,
    updatedAt: z.string().trim().min(1).optional()
}).strict();

export const ArtifactSnapshotChangedEventSchema = z.object({
    reference: ArtifactEventSubjectSchema,
    snapshot: ArtifactDataSchema
}).strict();

export const artifactRemoteQueryInputSchemas = {
    read: ArtifactLocatorSchema,
    readDocument: ArtifactLocatorSchema
} as const;

export const artifactRemoteCommandInputSchemas = {
    writeDocument: ArtifactWriteInputSchema
} as const;

export const artifactRemoteQueryResultSchemas = {
    read: ArtifactDataSchema,
    readDocument: ArtifactBodySnapshotSchema
} as const;

export const artifactRemoteCommandResultSchemas = {
    writeDocument: ArtifactBodySnapshotSchema
} as const;

export type ArtifactLocatorType = z.infer<typeof ArtifactLocatorSchema>;
export type ArtifactEventSubjectType = z.infer<typeof ArtifactEventSubjectSchema>;
export type ArtifactBodyType = z.infer<typeof ArtifactBodySchema>;
export type ArtifactWriteInputType = z.infer<typeof ArtifactWriteInputSchema>;
export type ArtifactStorageType = z.infer<typeof ArtifactStorageSchema>;
export type ArtifactDataType = z.infer<typeof ArtifactDataSchema>;
export type ArtifactBodySnapshotType = z.infer<typeof ArtifactBodySnapshotSchema>;
export type ArtifactSnapshotChangedEventType = z.infer<typeof ArtifactSnapshotChangedEventSchema>;

