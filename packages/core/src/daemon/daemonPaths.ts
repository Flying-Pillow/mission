import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { getMissionDirectoryPath } from '../lib/repoConfig.js';
import type { Manifest } from './protocol.js';

const MISSION_DAEMON_DIRECTORY = 'daemon';
const MISSION_DAEMON_MANIFEST_FILE = 'daemon.json';
const MISSION_DAEMON_SESSIONS_DIRECTORY = 'sessions';

export function getMissionDaemonStatePath(repoRoot: string): string {
	return path.join(getMissionDirectoryPath(repoRoot), MISSION_DAEMON_DIRECTORY);
}

export function getDaemonManifestPath(repoRoot: string): string {
	return path.join(getMissionDaemonStatePath(repoRoot), MISSION_DAEMON_MANIFEST_FILE);
}

export function getDaemonSessionStatePath(repoRoot: string, missionId: string): string {
	return path.join(
		getMissionDaemonStatePath(repoRoot),
		MISSION_DAEMON_SESSIONS_DIRECTORY,
		`${missionId}.json`
	);
}

export function resolveDaemonSocketPath(
	repoRoot: string,
	overridePath?: string
): string {
	const normalizedOverride = overridePath?.trim();
	if (normalizedOverride) {
		return path.resolve(normalizedOverride);
	}

	const repoHash = createHash('sha256')
		.update(path.resolve(repoRoot), 'utf8')
		.digest('hex')
		.slice(0, 16);
	if (process.platform === 'win32') {
		return `\\\\.\\pipe\\mission-${repoHash}`;
	}

	return path.join(os.tmpdir(), 'mission', `${repoHash}.sock`);
}

export function isNamedPipePath(candidatePath: string): boolean {
	return candidatePath.startsWith('\\\\.\\pipe\\');
}

export async function readDaemonManifest(
	repoRoot: string
): Promise<Manifest | undefined> {
	try {
		const content = await fs.readFile(getDaemonManifestPath(repoRoot), 'utf8');
		return JSON.parse(content) as Manifest;
	} catch {
		return undefined;
	}
}