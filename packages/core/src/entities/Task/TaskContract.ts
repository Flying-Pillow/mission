import type { EntityContract } from '../Entity/EntityContract.js';
import {
    missionTaskEntityName,
    taskIdentityPayloadSchema,
    taskExecuteCommandPayloadSchema,
    missionTaskSnapshotSchema,
    taskCommandAcknowledgementSchema
} from './TaskSchema.js';

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
