import type { EntityContract } from '../Entity/EntityContract.js';
import {
    missionArtifactEntityName,
    artifactIdentityPayloadSchema,
    artifactExecuteCommandPayloadSchema,
    artifactWriteDocumentPayloadSchema,
    missionArtifactSnapshotSchema,
    artifactDocumentSnapshotSchema,
    artifactCommandAcknowledgementSchema
} from './ArtifactSchema.js';

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
