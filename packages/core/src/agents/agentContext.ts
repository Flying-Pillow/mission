/**
 * @file packages/core/src/agents/agentContext.ts
 * @description Defines the first-class mission agent context contract and policy helpers.
 */

export type AgentEnvironment = 'local' | 'cloud';

export type AgentMode = 'interactive' | 'autonomous';

export type AgentContext = {
	environment: AgentEnvironment;
	mode: AgentMode;
};

export class MissionAgentContext {
	public static resolveEnvironment(): AgentEnvironment {
		if (
			process.env['COPILOT_AGENT_PROFILE'] === 'local' ||
			process.env['COPILOT_AGENT_PROFILE'] === 'cloud'
		) {
			return process.env['COPILOT_AGENT_PROFILE'];
		}

		if (process.env['FP_AGENT_PROFILE'] === 'local' || process.env['FP_AGENT_PROFILE'] === 'cloud') {
			return process.env['FP_AGENT_PROFILE'];
		}

		if (process.env['GITHUB_ACTIONS'] === 'true') {
			return 'cloud';
		}

		return 'local';
	}

	public static build(options?: {
		environment?: AgentEnvironment;
		autopilot?: boolean;
		mode?: AgentMode;
	}): AgentContext {
		const environment = options?.environment ?? MissionAgentContext.resolveEnvironment();
		const mode =
			options?.mode ??
			(options?.autopilot === true || environment === 'cloud' ? 'autonomous' : 'interactive');

		if (environment === 'cloud' && mode === 'interactive') {
			throw new Error(
				"Cloud mission execution requires agentContext.mode 'autonomous'. Interactive cloud missions are not allowed."
			);
		}

		return { environment, mode };
	}

	public static getAutopilotMode(agentContext: AgentContext) {
		return agentContext.mode === 'autonomous' ? ('enabled' as const) : ('disabled' as const);
	}

	public static resolveStopInstructionsMode(
		agentContext: AgentContext,
		requestedMode?: 'required' | 'optional'
	) {
		if (agentContext.mode === 'interactive') {
			if (requestedMode === 'optional') {
				throw new Error(
					"agentContext.mode 'interactive' requires stop instructions to remain 'required'."
				);
			}

			return 'required' as const;
		}

		return requestedMode ?? 'optional';
	}

	public static format(agentContext?: AgentContext) {
		if (!agentContext) {
			return 'unknown';
		}

		return `${agentContext.environment} / ${agentContext.mode}`;
	}

	public static assertLocalIssueWorkflow(commandName: string) {
		if (MissionAgentContext.resolveEnvironment() !== 'cloud') {
			return;
		}

		throw new Error(
			`${commandName} is a local mission-briefing command and is not allowed when agentContext.environment is cloud. Use pnpm mission:bootstrap and follow development/instructions/workflows/cloud.md.`
		);
	}

	public static assertLocalMissionWorkflow(commandName: string) {
		if (MissionAgentContext.resolveEnvironment() !== 'cloud') {
			return;
		}

		throw new Error(
			`${commandName} is a local mission-workflow command and is not allowed when agentContext.environment is cloud. Use pnpm mission:bootstrap and follow development/instructions/workflows/cloud.md.`
		);
	}
}