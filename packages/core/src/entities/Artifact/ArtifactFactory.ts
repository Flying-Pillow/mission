import { MISSION_STAGE_FOLDERS, type MissionArtifactKey, type MissionStageId } from '../../types.js';
import { getMissionArtifactDefinition } from '../../workflow/mission/manifest.js';
import { createArtifactEntityId, resolveArtifactMimeType } from './Artifact.js';
import { ArtifactDataSchema, type ArtifactDataType } from './ArtifactSchema.js';

export function createMissionArtifact(input: {
    missionId: string;
    artifactKey: MissionArtifactKey;
    missionRootDir?: string;
    filePath?: string;
    stageId?: MissionStageId;
}): ArtifactDataType {
    const definition = getMissionArtifactDefinition(input.artifactKey);
    const relativePath = definition.stageId
        ? `${MISSION_STAGE_FOLDERS[definition.stageId]}/${definition.fileName}`
        : definition.fileName;
    const artifactId = definition.stageId
        ? `stage:${definition.stageId}:${definition.key}`
        : `mission:${definition.key}`;
    return ArtifactDataSchema.parse({
        id: createArtifactEntityId(input.missionId, artifactId),
        artifactId,
        kind: definition.stageId ? 'stage' : 'mission',
        key: definition.key,
        label: definition.label,
        fileName: definition.fileName,
        mimeType: resolveArtifactMimeType(definition.fileName),
        ...(input.stageId ?? definition.stageId ? { stageId: input.stageId ?? definition.stageId } : {}),
        ...(input.filePath ? { filePath: input.filePath } : {}),
        ...(input.filePath || input.missionRootDir ? { relativePath } : {})
    });
}

export function createTaskArtifact(input: {
    missionId: string;
    taskId: string;
    stageId: MissionStageId;
    fileName: string;
    label?: string;
    filePath?: string;
    relativePath?: string;
}): ArtifactDataType {
    const artifactId = `task:${input.taskId}`;
    return ArtifactDataSchema.parse({
        id: createArtifactEntityId(input.missionId, artifactId),
        artifactId,
        kind: 'task',
        label: input.label ?? input.fileName,
        fileName: input.fileName,
        mimeType: resolveArtifactMimeType(input.fileName),
        stageId: input.stageId,
        taskId: input.taskId,
        ...(input.filePath ? { filePath: input.filePath } : {}),
        ...(input.relativePath ? { relativePath: input.relativePath } : {})
    });
}
