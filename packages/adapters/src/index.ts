import {
 	type MissionAgentRuntime
} from '../../core/build/daemon/MissionAgentRuntime.js';
import { CopilotAgentRuntime } from '../../core/build/adapters/CopilotAgentRuntime.js';
import { readMissionRepoSettings } from '../../core/build/lib/repoConfig.js';

export { CopilotAgentRuntime };

export async function createConfiguredMissionRuntimes(options: {
	repoRoot: string;
	logLine?: (line: string) => void;
}): Promise<MissionAgentRuntime[]> {
	const repoSettings = readMissionRepoSettings(options.repoRoot);
	const runtimeProvider = repoSettings?.runtimeProvider?.trim();

	if (!runtimeProvider) {
		return [];
	}

	if (runtimeProvider !== 'copilot-cli') {
		throw new Error(`Mission adapters do not support runtime provider '${runtimeProvider}'.`);
	}

	return [
		new CopilotAgentRuntime({
			...(repoSettings?.runtimeCommand ? { command: repoSettings.runtimeCommand } : {}),
			...(options.logLine ? { logLine: options.logLine } : {})
		})
	];
}
