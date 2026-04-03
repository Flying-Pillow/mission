import * as fs from 'node:fs/promises';
import {
	getDefaultMissionRepoSettingsWithOverrides,
	getMissionActiveMissionsPath,
	getMissionDirectoryPath,
	getMissionMissionsPath,
	getMissionSettingsPath
} from './lib/repoConfig.js';

export type MissionRepositoryInitialization = {
	controlDirectoryPath: string;
	settingsPath: string;
	missionsRoot: string;
};

export async function initializeMissionRepository(
	repoRoot: string
): Promise<MissionRepositoryInitialization> {
	const controlDirectoryPath = getMissionDirectoryPath(repoRoot);
	const settingsPath = getMissionSettingsPath(repoRoot);
	const missionsRoot = getMissionMissionsPath(repoRoot);
	const activeMissionsRoot = getMissionActiveMissionsPath(repoRoot);

	await Promise.all([
		fs.mkdir(controlDirectoryPath, { recursive: true }),
		fs.mkdir(missionsRoot, { recursive: true }),
		fs.mkdir(activeMissionsRoot, { recursive: true })
	]);

	const settings = getDefaultMissionRepoSettingsWithOverrides();

	await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

	return {
		controlDirectoryPath,
		settingsPath,
		missionsRoot
	};
}