import { z } from 'zod/v4';
import type { EntityContract } from '../Entity/EntityContract.js';
import {
    entityCommandAcknowledgementSchema,
    entityCommandDescriptorSchema
} from '../Entity/EntityContract.js';
import { missionArtifactSnapshotSchema } from '../Artifact/ArtifactContract.js';
import { missionTaskSnapshotSchema } from '../Task/TaskContract.js';

export const missionStageEntityName = 'Stage' as const;
export const stageEntityName = missionStageEntityName;

export const stageIdentityPayloadSchema = z.object({
    missionId: z.string().trim().min(1),
    repositoryRootPath: z.string().trim().min(1).optional(),
    stageId: z.string().trim().min(1)
}).strict();

export const stageEntityReferenceSchema = stageIdentityPayloadSchema.extend({
    entity: z.literal(missionStageEntityName)
}).strict();

export const stageExecuteCommandPayloadSchema = stageIdentityPayloadSchema.extend({
    commandId: z.string().trim().min(1),
    input: z.unknown().optional()
}).strict();

export const missionStageSnapshotSchema = z.object({
    stageId: z.string().trim().min(1),
    lifecycle: z.string().trim().min(1),
    isCurrentStage: z.boolean(),
    artifacts: z.array(missionArtifactSnapshotSchema),
    tasks: z.array(missionTaskSnapshotSchema),
    commands: z.array(entityCommandDescriptorSchema).optional()
}).strict();

export const stageSnapshotSchema = missionStageSnapshotSchema;

export const stageCommandAcknowledgementSchema = entityCommandAcknowledgementSchema.extend({
    entity: z.literal(missionStageEntityName),
    method: z.literal('executeCommand'),
    id: z.string().trim().min(1),
    missionId: z.string().trim().min(1),
    stageId: z.string().trim().min(1),
    commandId: z.string().trim().min(1)
}).strict();

export const stageRemoteQueryPayloadSchemas = {
    read: stageIdentityPayloadSchema
} as const;

export const stageRemoteCommandPayloadSchemas = {
    executeCommand: stageExecuteCommandPayloadSchema
} as const;

export const stageRemoteQueryResultSchemas = {
    read: missionStageSnapshotSchema
} as const;

export const stageRemoteCommandResultSchemas = {
    executeCommand: stageCommandAcknowledgementSchema
} as const;

export type StageIdentityPayload = z.infer<typeof stageIdentityPayloadSchema>;
export type StageEntityReference = z.infer<typeof stageEntityReferenceSchema>;
export type StageExecuteCommandPayload = z.infer<typeof stageExecuteCommandPayloadSchema>;
export type MissionStageSnapshot = z.infer<typeof missionStageSnapshotSchema>;
export type StageSnapshot = z.infer<typeof stageSnapshotSchema>;
export type StageCommandAcknowledgement = z.infer<typeof stageCommandAcknowledgementSchema>;

export const stageEntityContract: EntityContract = {
    entity: missionStageEntityName,
    queries: {
        read: {
            payload: stageIdentityPayloadSchema,
            result: missionStageSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const mission = await service.loadRequiredMissionRuntime(payload, context);
                try {
                    return missionStageSnapshotSchema.parse(service.requireStage(await service.buildMissionSnapshot(mission, payload.missionId), payload.stageId));
                } finally {
                    mission.dispose();
                }
            }
        }
    },
    commands: {
        executeCommand: {
            payload: stageExecuteCommandPayloadSchema,
            result: stageCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const mission = await service.loadRequiredMissionRuntime(payload, context);
                try {
                    service.requireStage(await service.buildMissionSnapshot(mission, payload.missionId), payload.stageId);
                    await mission.executeAction(resolveStageActionId(payload.commandId, payload.stageId), []);
                    return stageCommandAcknowledgementSchema.parse({
                        ok: true,
                        entity: 'Stage',
                        method: 'executeCommand',
                        id: payload.stageId,
                        missionId: payload.missionId,
                        stageId: payload.stageId,
                        commandId: payload.commandId
                    });
                } finally {
                    mission.dispose();
                }
            }
        }
    }
};

function resolveStageActionId(commandId: string, stageId: string): string {
    if (commandId === 'stage.generateTasks') {
        return `generation.tasks.${stageId}`;
    }
    throw new Error(`Stage command '${commandId}' is not implemented in the daemon.`);
}

async function loadMissionDaemonService(context: Parameters<typeof import('../../daemon/runtime/mission/MissionDaemonService.js').requireMissionDaemonService>[0]) {
    const { requireMissionDaemonService } = await import('../../daemon/runtime/mission/MissionDaemonService.js');
    return requireMissionDaemonService(context);
}
