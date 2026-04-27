import { z } from 'zod/v4';
import type { EntityContract } from '../Entity/EntityContract.js';
import {
    entityCommandAcknowledgementSchema,
    entityCommandDescriptorSchema
} from '../Entity/EntityContract.js';

export const missionTaskEntityName = 'Task' as const;
export const taskEntityName = missionTaskEntityName;

export const taskIdentityPayloadSchema = z.object({
    missionId: z.string().trim().min(1),
    repositoryRootPath: z.string().trim().min(1).optional(),
    taskId: z.string().trim().min(1)
}).strict();

export const taskEntityReferenceSchema = taskIdentityPayloadSchema.extend({
    entity: z.literal(missionTaskEntityName)
}).strict();

export const taskExecuteCommandPayloadSchema = taskIdentityPayloadSchema.extend({
    commandId: z.string().trim().min(1),
    input: z.unknown().optional()
}).strict();

export const missionTaskSnapshotSchema = z.object({
    taskId: z.string().trim().min(1),
    stageId: z.string().trim().min(1),
    sequence: z.number().int().positive(),
    title: z.string().trim().min(1),
    instruction: z.string(),
    lifecycle: z.string().trim().min(1),
    dependsOn: z.array(z.string().trim().min(1)),
    waitingOnTaskIds: z.array(z.string().trim().min(1)),
    agentRunner: z.string().trim().min(1),
    retries: z.number().int().nonnegative(),
    fileName: z.string().trim().min(1).optional(),
    filePath: z.string().trim().min(1).optional(),
    relativePath: z.string().trim().min(1).optional(),
    commands: z.array(entityCommandDescriptorSchema).optional()
}).strict();

export const taskSnapshotSchema = missionTaskSnapshotSchema;

export const taskCommandAcknowledgementSchema = entityCommandAcknowledgementSchema.extend({
    entity: z.literal(missionTaskEntityName),
    method: z.literal('executeCommand'),
    id: z.string().trim().min(1),
    missionId: z.string().trim().min(1),
    taskId: z.string().trim().min(1),
    commandId: z.string().trim().min(1)
}).strict();

export const taskRemoteQueryPayloadSchemas = {
    read: taskIdentityPayloadSchema
} as const;

export const taskRemoteCommandPayloadSchemas = {
    executeCommand: taskExecuteCommandPayloadSchema
} as const;

export const taskRemoteQueryResultSchemas = {
    read: missionTaskSnapshotSchema
} as const;

export const taskRemoteCommandResultSchemas = {
    executeCommand: taskCommandAcknowledgementSchema
} as const;

export type TaskIdentityPayload = z.infer<typeof taskIdentityPayloadSchema>;
export type TaskEntityReference = z.infer<typeof taskEntityReferenceSchema>;
export type TaskExecuteCommandPayload = z.infer<typeof taskExecuteCommandPayloadSchema>;
export type MissionTaskSnapshot = z.infer<typeof missionTaskSnapshotSchema>;
export type TaskSnapshot = z.infer<typeof taskSnapshotSchema>;
export type TaskCommandAcknowledgement = z.infer<typeof taskCommandAcknowledgementSchema>;

export const taskEntityContract: EntityContract = {
    entity: missionTaskEntityName,
    queries: {
        read: {
            payload: taskIdentityPayloadSchema,
            result: missionTaskSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const mission = await service.loadRequiredMissionRuntime(payload, context);
                try {
                    return missionTaskSnapshotSchema.parse(service.requireTask(await service.buildMissionSnapshot(mission, payload.missionId), payload.taskId));
                } finally {
                    mission.dispose();
                }
            }
        }
    },
    commands: {
        executeCommand: {
            payload: taskExecuteCommandPayloadSchema,
            result: taskCommandAcknowledgementSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemonService(context);
                const terminalSessionName = service.getTerminalSessionName(payload.input);
                const mission = await service.loadRequiredMissionRuntime(payload, context, terminalSessionName);
                try {
                    service.requireTask(await service.buildMissionSnapshot(mission, payload.missionId), payload.taskId);
                    switch (payload.commandId) {
                        case 'task.start':
                            await mission.startTask(payload.taskId, terminalSessionName ? { terminalSessionName } : {});
                            break;
                        case 'task.complete':
                            await mission.completeTask(payload.taskId);
                            break;
                        case 'task.reopen':
                            await mission.reopenTask(payload.taskId);
                            break;
                        default:
                            throw new Error(`Task command '${payload.commandId}' is not implemented in the daemon.`);
                    }
                    return taskCommandAcknowledgementSchema.parse({
                        ok: true,
                        entity: 'Task',
                        method: 'executeCommand',
                        id: payload.taskId,
                        missionId: payload.missionId,
                        taskId: payload.taskId,
                        commandId: payload.commandId
                    });
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
