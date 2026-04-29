import type { FrontmatterValue } from '../../lib/frontmatter.js';
import type { EntityExecutionContext } from '../Entity/Entity.js';
import { FilesystemAdapter } from '../../lib/FilesystemAdapter.js';
import {
	MISSION_ARTIFACTS,
	MISSION_STAGE_FOLDERS,
	type MissionArtifactKey,
	type MissionStageId,
	type MissionTaskAgent,
	type MissionTaskStatus
} from '../../types.js';
import { getMissionArtifactDefinition } from '../../workflow/mission/manifest.js';
import {
	artifactExecuteCommandPayloadSchema,
	artifactDocumentSnapshotSchema,
	artifactIdentityPayloadSchema,
	artifactWriteDocumentPayloadSchema,
	missionArtifactSnapshotSchema
} from './ArtifactSchema.js';

export type ArtifactKind = 'mission' | 'stage' | 'task';

export type Artifact = {
	artifactId: string;
	kind: ArtifactKind;
	label: string;
	fileName: string;
	key?: MissionArtifactKey;
	stageId?: MissionStageId;
	taskId?: string;
	filePath?: string;
	relativePath?: string;
};

type ProductArtifactDefinition = {
	kind: 'product';
	key: MissionArtifactKey;
	body: string;
	attributes?: Record<string, FrontmatterValue>;
};

type TaskArtifactDefinition = {
	kind: 'task';
	stageId: MissionStageId;
	fileName: string;
	subject: string;
	instruction: string;
	dependsOn?: string[];
	agent: MissionTaskAgent;
	status?: MissionTaskStatus;
	retries?: number;
};

class ArtifactRuntime {
	public constructor(
		private readonly missionDir: string,
		private readonly definition: ProductArtifactDefinition | TaskArtifactDefinition
	) { }

	public getFileName(): string {
		return this.definition.kind === 'product'
			? MISSION_ARTIFACTS[this.definition.key]
			: this.definition.fileName;
	}

	public getRelativePath(): string {
		if (this.definition.kind === 'product') {
			const definition = getMissionArtifactDefinition(this.definition.key);
			const stageFolder = definition.stageId ? MISSION_STAGE_FOLDERS[definition.stageId] : undefined;
			return stageFolder
				? `${stageFolder}/${MISSION_ARTIFACTS[this.definition.key]}`
				: MISSION_ARTIFACTS[this.definition.key];
		}

		return `${MISSION_STAGE_FOLDERS[this.definition.stageId]}/tasks/${this.definition.fileName}`;
	}

	public async exists(adapter: FilesystemAdapter): Promise<boolean> {
		return this.definition.kind === 'product'
			? adapter.artifactExists(this.missionDir, this.definition.key)
			: adapter.taskExists(this.missionDir, this.definition.stageId, this.definition.fileName);
	}

	public async materialize(adapter: FilesystemAdapter): Promise<void> {
		if (await this.exists(adapter)) {
			return;
		}

		if (this.definition.kind === 'product') {
			await adapter.writeArtifactRecord(this.missionDir, this.definition.key, {
				...(this.definition.attributes ? { attributes: this.definition.attributes } : {}),
				body: this.definition.body
			});
			return;
		}

		await adapter.writeTaskRecord(this.missionDir, this.definition.stageId, this.definition.fileName, {
			subject: this.definition.subject,
			instruction: this.definition.instruction,
			...(this.definition.dependsOn ? { dependsOn: this.definition.dependsOn } : {}),
			agent: this.definition.agent,
			...(this.definition.status ? { status: this.definition.status } : {}),
			...(this.definition.retries !== undefined ? { retries: this.definition.retries } : {})
		});
	}
}

export const ArtifactRuntimeController = ArtifactRuntime;

export class ArtifactEntity {
	public static async read(payload: unknown, context: EntityExecutionContext) {
		const input = artifactIdentityPayloadSchema.parse(payload);
		const service = await loadMissionDaemon(context);
		const mission = await service.loadRequiredMission(input, context);
		try {
			return missionArtifactSnapshotSchema.parse(service.requireArtifact(await service.buildMissionSnapshot(mission, input.missionId), input.artifactId));
		} finally {
			mission.dispose();
		}
	}

	public static async readDocument(payload: unknown, context: EntityExecutionContext) {
		const input = artifactIdentityPayloadSchema.parse(payload);
		const service = await loadMissionDaemon(context);
		const mission = await service.loadRequiredMission(input, context);
		try {
			const snapshot = await service.buildMissionSnapshot(mission, input.missionId);
			const artifact = service.requireArtifact(snapshot, input.artifactId);
			const filePath = service.requireArtifactFilePath(snapshot, artifact);
			await service.assertMissionDocumentPath(filePath, 'read', service.resolveControlRoot(input, context));
			return artifactDocumentSnapshotSchema.parse(await service.readMissionDocument(filePath));
		} finally {
			mission.dispose();
		}
	}

	public static async writeDocument(payload: unknown, context: EntityExecutionContext) {
		const input = artifactWriteDocumentPayloadSchema.parse(payload);
		const service = await loadMissionDaemon(context);
		const mission = await service.loadRequiredMission(input, context);
		try {
			const snapshot = await service.buildMissionSnapshot(mission, input.missionId);
			const artifact = service.requireArtifact(snapshot, input.artifactId);
			const filePath = service.requireArtifactFilePath(snapshot, artifact);
			await service.assertMissionDocumentPath(filePath, 'write', service.resolveControlRoot(input, context));
			return artifactDocumentSnapshotSchema.parse(await service.writeMissionDocument(filePath, input.content));
		} finally {
			mission.dispose();
		}
	}

	public static async executeCommand(payload: unknown, context: EntityExecutionContext) {
		const input = artifactExecuteCommandPayloadSchema.parse(payload);
		const service = await loadMissionDaemon(context);
		const mission = await service.loadRequiredMission(input, context);
		try {
			service.requireArtifact(await service.buildMissionSnapshot(mission, input.missionId), input.artifactId);
			throw new Error(`Artifact command '${input.commandId}' is not implemented in the daemon.`);
		} finally {
			mission.dispose();
		}
	}
}

async function loadMissionDaemon(context: EntityExecutionContext) {
	const { requireMissionDaemon } = await import('../../daemon/MissionDaemon.js');
	return requireMissionDaemon(context);
}

export function createMissionArtifact(input: {
	artifactKey: MissionArtifactKey;
	missionRootDir?: string;
	filePath?: string;
	stageId?: MissionStageId;
}): Artifact {
	const definition = getMissionArtifactDefinition(input.artifactKey);
	const relativePath = definition.stageId
		? `${MISSION_STAGE_FOLDERS[definition.stageId]}/${definition.fileName}`
		: definition.fileName;
	return {
		artifactId: definition.stageId
			? `stage:${definition.stageId}:${definition.key}`
			: `mission:${definition.key}`,
		kind: definition.stageId ? 'stage' : 'mission',
		key: definition.key,
		label: definition.label,
		fileName: definition.fileName,
		...(input.stageId ?? definition.stageId ? { stageId: input.stageId ?? definition.stageId } : {}),
		...(input.filePath ? { filePath: input.filePath } : {}),
		...(input.filePath || input.missionRootDir ? { relativePath } : {})
	};
}

export function createTaskArtifact(input: {
	taskId: string;
	stageId: MissionStageId;
	fileName: string;
	label?: string;
	filePath?: string;
	relativePath?: string;
}): Artifact {
	return {
		artifactId: `task:${input.taskId}`,
		kind: 'task',
		label: input.label ?? input.fileName,
		fileName: input.fileName,
		stageId: input.stageId,
		taskId: input.taskId,
		...(input.filePath ? { filePath: input.filePath } : {}),
		...(input.relativePath ? { relativePath: input.relativePath } : {})
	};
}

export async function collectArtifactFiles(input: {
	adapter: FilesystemAdapter;
	missionDir: string;
}): Promise<Partial<Record<MissionArtifactKey, string>>> {
	const entries = await Promise.all(
		(Object.keys(MISSION_ARTIFACTS) as MissionArtifactKey[]).map(async (artifact) => {
			const filePath = await input.adapter.readArtifactRecord(input.missionDir, artifact).then(
				(record) => record?.filePath
			);
			const exists = await input.adapter.artifactExists(input.missionDir, artifact);
			return exists && filePath ? ([artifact, filePath] as const) : undefined;
		})
	);

	const result: Partial<Record<MissionArtifactKey, string>> = {};
	for (const entry of entries) {
		if (!entry) {
			continue;
		}
		result[entry[0]] = entry[1];
	}
	return result;
}