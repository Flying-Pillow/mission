/**
 * @file packages/core/src/lib/repoConfig.ts
 * @description Defines repo-local Mission configuration defaults and helpers.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const MISSION_DIRECTORY = '.mission';
export const MISSION_SETTINGS_FILE = 'settings.json';

export type MissionRepoSettings = {
	runtimeProvider?: string;
	runtimeCommand?: string;
	trackingProvider?: 'github';
	trackingRepository?: string;
	instructionsPath?: string;
	skillsPath?: string;
	serverPort?: number;
};

export function getMissionDirectoryPath(repoRoot: string): string {
	return path.join(repoRoot, MISSION_DIRECTORY);
}

export function getMissionSettingsPath(repoRoot: string): string {
	return path.join(getMissionDirectoryPath(repoRoot), MISSION_SETTINGS_FILE);
}

export function getMissionMissionsPath(repoRoot: string): string {
	return path.join(getMissionDirectoryPath(repoRoot), 'missions');
}

export function getMissionActiveMissionsPath(repoRoot: string): string {
	return path.join(getMissionMissionsPath(repoRoot), 'active');
}

export function getDefaultMissionRepoSettings(): MissionRepoSettings {
	return getDefaultMissionRepoSettingsWithOverrides();
}

export function getDefaultMissionRepoSettingsWithOverrides(
	overrides: MissionRepoSettings = {}
): MissionRepoSettings {
	return {
		trackingProvider: 'github',
		instructionsPath: '.agents',
		skillsPath: '.agents/skills',
		serverPort: 4317,
		...overrides
	};
}

export function readMissionRepoSettings(repoRoot: string): MissionRepoSettings | undefined {
	const settingsPath = getMissionSettingsPath(repoRoot);
	try {
		const content = fs.readFileSync(settingsPath, 'utf8').trim();
		if (!content) {
			return undefined;
		}

		return JSON.parse(content) as MissionRepoSettings;
	} catch {
		return undefined;
	}
}