import * as path from 'node:path';
import { createEntityId, Entity, type EntityExecutionContext } from '../Entity/Entity.js';
import {
	ArtifactBodySnapshotSchema,
	ArtifactLocatorSchema,
	ArtifactWriteInputSchema,
	ArtifactDataSchema,
	artifactEntityName,
	type ArtifactDataType
} from './ArtifactSchema.js';
import type { MissionSnapshotType } from '../Mission/MissionSchema.js';

export type ArtifactKind = 'mission' | 'stage' | 'task';

export class Artifact extends Entity<ArtifactDataType, string> {
	public static override readonly entityName = artifactEntityName;

	public constructor(data: ArtifactDataType) {
		super(ArtifactDataSchema.parse(data));
	}

	public get id(): string {
		return this.data.id;
	}

	public static async read(payload: unknown, context: EntityExecutionContext) {
		const input = ArtifactLocatorSchema.parse(payload);
		const service = await loadMissionRegistry(context);
		const mission = await service.loadRequiredMission(input, context);
		try {
			return Artifact.requireData(await mission.buildMissionSnapshot(), input.artifactId);
		} finally {
			mission.dispose();
		}
	}

	public static requireData(snapshot: MissionSnapshotType, artifactId: string) {
		const artifact = snapshot.artifacts.find((candidate) => candidate.artifactId === artifactId);
		if (!artifact) {
			throw new Error(`Artifact '${artifactId}' could not be resolved in Mission '${snapshot.mission.missionId}'.`);
		}
		return ArtifactDataSchema.parse(artifact);
	}

	public static resolveDocumentPath(snapshot: MissionSnapshotType, artifactId: string): string {
		const artifact = Artifact.requireData(snapshot, artifactId);
		if (artifact.filePath) {
			return artifact.filePath;
		}
		if (artifact.relativePath && snapshot.mission.missionRootDir) {
			return path.join(snapshot.mission.missionRootDir, artifact.relativePath);
		}
		throw new Error(`Artifact '${artifactId}' does not have a readable document path.`);
	}

	public static async readDocument(payload: unknown, context: EntityExecutionContext) {
		const input = ArtifactLocatorSchema.parse(payload);
		const service = await loadMissionRegistry(context);
		const mission = await service.loadRequiredMission(input, context);
		try {
			const snapshot = await mission.buildMissionSnapshot();
			const artifact = Artifact.requireData(snapshot, input.artifactId);
			const filePath = Artifact.resolveDocumentPath(snapshot, input.artifactId);
			await service.assertMissionDocumentPath(filePath, 'read', service.resolveControlRoot(input, context));
			return ArtifactBodySnapshotSchema.parse(toArtifactBodySnapshot(
				await service.readMissionDocument(filePath),
				artifact.mimeType
			));
		} finally {
			mission.dispose();
		}
	}

	public static async writeDocument(payload: unknown, context: EntityExecutionContext) {
		const input = ArtifactWriteInputSchema.parse(payload);
		const service = await loadMissionRegistry(context);
		const mission = await service.loadRequiredMission(input, context);
		try {
			const snapshot = await mission.buildMissionSnapshot();
			const artifact = Artifact.requireData(snapshot, input.artifactId);
			if (input.body.mimeType !== artifact.mimeType) {
				throw new Error(`Artifact '${input.artifactId}' expects MIME type '${artifact.mimeType}'.`);
			}
			const filePath = Artifact.resolveDocumentPath(snapshot, input.artifactId);
			await service.assertMissionDocumentPath(filePath, 'write', service.resolveControlRoot(input, context));
			return ArtifactBodySnapshotSchema.parse(toArtifactBodySnapshot(
				await service.writeMissionDocument(filePath, input.body.content),
				artifact.mimeType
			));
		} finally {
			mission.dispose();
		}
	}

}

export function createArtifactEntityId(missionId: string, artifactId: string): string {
	return createEntityId('artifact', `${missionId}/${artifactId}`);
}

export function resolveArtifactMimeType(fileName: string): string {
	const extension = path.extname(fileName).toLowerCase();
	if (extension === '.md' || extension === '.markdown') {
		return 'text/markdown';
	}
	if (extension === '.json') {
		return 'application/json';
	}
	if (extension === '.txt') {
		return 'text/plain';
	}
	if (extension === '.png') {
		return 'image/png';
	}
	if (extension === '.jpg' || extension === '.jpeg') {
		return 'image/jpeg';
	}
	if (extension === '.pdf') {
		return 'application/pdf';
	}
	if (extension === '.docx') {
		return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	}
	if (extension === '.xlsx') {
		return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
	}
	return 'application/octet-stream';
}

function toArtifactBodySnapshot(
	document: { filePath: string; content: string; updatedAt?: string | undefined },
	mimeType: string
) {
	return {
		filePath: document.filePath,
		body: {
			mimeType,
			content: document.content
		},
		...(document.updatedAt ? { updatedAt: document.updatedAt } : {})
	};
}

async function loadMissionRegistry(context: EntityExecutionContext) {
	const { requireMissionRegistry } = await import('../../daemon/MissionRegistry.js');
	return requireMissionRegistry(context);
}