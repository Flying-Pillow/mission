import { z } from 'zod/v4';
import type { EntityContract } from '../Entity/EntityContract.js';
import {
    entityCommandAcknowledgementSchema,
    entityCommandDescriptorSchema
} from '../Entity/EntityContract.js';

export const missionArtifactEntityName = 'Artifact' as const;
export const artifactEntityName = missionArtifactEntityName;

export const artifactIdentityPayloadSchema = z.object({
    missionId: z.string().trim().min(1),
    repositoryRootPath: z.string().trim().min(1).optional(),
    artifactId: z.string().trim().min(1)
}).strict();

export const artifactEntityReferenceSchema = artifactIdentityPayloadSchema.extend({
    entity: z.literal(missionArtifactEntityName)
}).strict();

export const artifactExecuteCommandPayloadSchema = artifactIdentityPayloadSchema.extend({
    commandId: z.string().trim().min(1),
    input: z.unknown().optional()
}).strict();

export const artifactWriteDocumentPayloadSchema = artifactIdentityPayloadSchema.extend({
    content: z.string()
}).strict();

export const missionArtifactSnapshotSchema = z.object({
    artifactId: z.string().trim().min(1),
    kind: z.enum(['mission', 'stage', 'task']),
    label: z.string().trim().min(1),
    fileName: z.string().trim().min(1),
    key: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1).optional(),
    taskId: z.string().trim().min(1).optional(),
    filePath: z.string().trim().min(1).optional(),
    relativePath: z.string().trim().min(1).optional(),
    commands: z.array(entityCommandDescriptorSchema).optional()
}).strict();

export const artifactSnapshotSchema = missionArtifactSnapshotSchema;

export const artifactDocumentSnapshotSchema = z.object({
    filePath: z.string().trim().min(1),
    content: z.string(),
    updatedAt: z.string().trim().min(1).optional()
}).strict();

export const artifactCommandAcknowledgementSchema = entityCommandAcknowledgementSchema.extend({
    entity: z.literal(missionArtifactEntityName),
    method: z.literal('executeCommand'),
    id: z.string().trim().min(1),
    missionId: z.string().trim().min(1),
    artifactId: z.string().trim().min(1),
    commandId: z.string().trim().min(1)
}).strict();

export const artifactRemoteQueryPayloadSchemas = {
    read: artifactIdentityPayloadSchema,
    readDocument: artifactIdentityPayloadSchema
} as const;

export const artifactRemoteCommandPayloadSchemas = {
    writeDocument: artifactWriteDocumentPayloadSchema,
    executeCommand: artifactExecuteCommandPayloadSchema
} as const;

export const artifactRemoteQueryResultSchemas = {
    read: missionArtifactSnapshotSchema,
    readDocument: artifactDocumentSnapshotSchema
} as const;

export const artifactRemoteCommandResultSchemas = {
    writeDocument: artifactDocumentSnapshotSchema,
    executeCommand: artifactCommandAcknowledgementSchema
} as const;

export type ArtifactIdentityPayload = z.infer<typeof artifactIdentityPayloadSchema>;
export type ArtifactEntityReference = z.infer<typeof artifactEntityReferenceSchema>;
export type ArtifactExecuteCommandPayload = z.infer<typeof artifactExecuteCommandPayloadSchema>;
export type ArtifactWriteDocumentPayload = z.infer<typeof artifactWriteDocumentPayloadSchema>;
export type MissionArtifactSnapshot = z.infer<typeof missionArtifactSnapshotSchema>;
export type ArtifactSnapshot = z.infer<typeof artifactSnapshotSchema>;
export type ArtifactDocumentSnapshot = z.infer<typeof artifactDocumentSnapshotSchema>;
export type ArtifactCommandAcknowledgement = z.infer<typeof artifactCommandAcknowledgementSchema>;

export const artifactEntityContract: EntityContract = {
    entity: missionArtifactEntityName,
    queries: {
        read: {
            payload: artifactIdentityPayloadSchema,
            result: missionArtifactSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const mission = await service.loadRequiredMissionRuntime(payload, context);
                try {
                    return missionArtifactSnapshotSchema.parse(service.requireArtifact(await service.buildMissionSnapshot(mission, payload.missionId), payload.artifactId));
                } finally {
                    mission.dispose();
                }
            }
        },
        readDocument: {
            payload: artifactIdentityPayloadSchema,
            result: artifactDocumentSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const mission = await service.loadRequiredMissionRuntime(payload, context);
                try {
                    const snapshot = await service.buildMissionSnapshot(mission, payload.missionId);
                    const artifact = service.requireArtifact(snapshot, payload.artifactId);
                    const filePath = service.requireArtifactFilePath(snapshot, artifact);
                    await service.assertMissionDocumentPath(filePath, 'read', service.resolveControlRoot(payload, context));
                    return artifactDocumentSnapshotSchema.parse(await service.readMissionDocument(filePath));
                } finally {
                    mission.dispose();
                }
            }
        }
    },
    commands: {
        writeDocument: {
            payload: artifactWriteDocumentPayloadSchema,
            result: artifactDocumentSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const mission = await service.loadRequiredMissionRuntime(payload, context);
                try {
                    const snapshot = await service.buildMissionSnapshot(mission, payload.missionId);
                    const artifact = service.requireArtifact(snapshot, payload.artifactId);
                    const filePath = service.requireArtifactFilePath(snapshot, artifact);
                    await service.assertMissionDocumentPath(filePath, 'write', service.resolveControlRoot(payload, context));
                    return artifactDocumentSnapshotSchema.parse(await service.writeMissionDocument(filePath, payload.content));
                } finally {
                    mission.dispose();
                }
            }
        },
        executeCommand: {
            payload: artifactExecuteCommandPayloadSchema,
            result: artifactCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const mission = await service.loadRequiredMissionRuntime(payload, context);
                try {
                    service.requireArtifact(await service.buildMissionSnapshot(mission, payload.missionId), payload.artifactId);
                    throw new Error(`Artifact command '${payload.commandId}' is not implemented in the daemon.`);
                } finally {
                    mission.dispose();
                }
            }
        }
    }
};

async function loadMissionDaemonService(context: Parameters<typeof import('../../daemon/runtime/mission/MissionDaemonService.js').requireMissionDaemonService>[0]) {
    const { requireMissionDaemonService } = await import('../../daemon/runtime/mission/MissionDaemonService.js');
    return requireMissionDaemonService(context);
}
