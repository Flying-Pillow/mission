import type { EntitySchema } from '../Entity/EntitySchema.js';
import {
    missionStageEntityName,
    stageIdentityPayloadSchema,
    stageExecuteCommandPayloadSchema,
    missionStageSnapshotSchema,
    stageCommandAcknowledgementSchema
} from './StageSchema.js';

export const stageEntityContract: EntitySchema = {
    entity: missionStageEntityName,
    queries: {
        read: {
            payload: stageIdentityPayloadSchema,
            result: missionStageSnapshotSchema,
            execute: async (payload, context) => {
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
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
                const service = await loadMissionDaemon(context);
                const mission = await service.loadRequiredMission(payload, context);
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

async function loadMissionDaemon(context: Parameters<typeof import('../../daemon/MissionDaemon.js').requireMissionDaemon>[0]) {
    const { requireMissionDaemon } = await import('../../daemon/MissionDaemon.js');
    return requireMissionDaemon(context);
}
