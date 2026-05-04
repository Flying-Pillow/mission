import {
	MISSION_AGENT_RUNNER_IDS,
	type MissionAgentRunnerType
} from '../../../../entities/Mission/MissionSchema.js';

export const [
	COPILOT_CLI_AGENT_RUNNER_ID,
	CLAUDE_CODE_AGENT_RUNNER_ID,
	PI_AGENT_RUNNER_ID,
	CODEX_AGENT_RUNNER_ID,
	OPENCODE_AGENT_RUNNER_ID
] = MISSION_AGENT_RUNNER_IDS;

export const SUPPORTED_AGENT_RUNNER_IDS = MISSION_AGENT_RUNNER_IDS;

export type SupportedAgentRunnerId = MissionAgentRunnerType;

export const DEFAULT_AGENT_RUNNER_ID = COPILOT_CLI_AGENT_RUNNER_ID;

export function isSupportedAgentRunner(
	runnerId: string | undefined
): runnerId is SupportedAgentRunnerId {
	return runnerId !== undefined
		&& (SUPPORTED_AGENT_RUNNER_IDS as readonly string[]).includes(runnerId);
}
