import { describe, expect, it } from 'vitest';
import type { AgentLaunchConfig } from '../AgentRuntimeTypes.js';
import {
	AgentProviderAdapter,
	ProviderInitializationError,
	UnsupportedCapabilityError,
	type AgentProviderSettings
} from './AgentProviderAdapter.js';

function createLaunchConfig(overrides: Partial<AgentLaunchConfig> = {}): AgentLaunchConfig {
	return {
		missionId: 'mission-31',
		workingDirectory: '/tmp/mission-work',
		task: {
			taskId: 'task-2',
			stageId: 'implementation',
			title: 'Adopt provider adapter',
			description: 'Adopt provider adapter',
			instruction: 'Implement the provider adapter.'
		},
		specification: {
			summary: 'Adopt the provider adapter.',
			documents: []
		},
		resume: { mode: 'new' },
		initialPrompt: {
			source: 'engine',
			text: 'Implement the provider adapter.'
		},
		...overrides
	};
}

function createAdapter(
	runnerId: 'claude-code' | 'pi' | 'codex' | 'opencode',
	settings: AgentProviderSettings
) {
	return new AgentProviderAdapter({
		runnerId,
		resolveSettings: () => settings
	});
}

describe('AgentProviderAdapter', () => {
	it('maps Claude Code exactly and preserves env precedence, resume, stdin, and usage parsing', () => {
		const adapter = createAdapter('claude-code', {
			model: 'claude-sonnet-4-7',
			launchMode: 'print',
			reasoningEffort: 'high',
			dangerouslySkipPermissions: true,
			resumeSession: 'claude-session-42',
			captureSessions: false,
			providerEnv: {
				ANTHROPIC_API_KEY: 'provider-key',
				SHARED: 'provider'
			},
			runtimeEnv: {
				PATH: '/usr/bin',
				SHARED: 'runtime'
			},
			launchEnv: {
				MISSION_AGENT_SESSION_ID: 'agent-session-1',
				SHARED: 'launch'
			}
		});

		const initialization = adapter.initialize(createLaunchConfig());
		const launch = adapter.buildPrintLaunch(createLaunchConfig());
		const usage = adapter.parseSessionUsage([
			'{"type":"system","subtype":"init","session_id":"claude-session-42"}',
			'{"type":"assistant","message":{"usage":{"input_tokens":12,"cache_creation_input_tokens":3,"cache_read_input_tokens":4,"output_tokens":5}}}'
		].join('\n'));
		const observations = adapter.parseRuntimeOutput(
			'{"type":"system","subtype":"init","session_id":"claude-session-42"}'
		);

		expect(initialization).toEqual({
			runnerId: 'claude-code',
			providerName: 'claude-code',
			model: 'claude-sonnet-4-7',
			capabilities: {
				interactive: true,
				print: true,
				streamParsing: true,
				sessionCapture: false,
				sessionUsage: true
			},
			interactionCapabilities: {
				mode: 'read-only',
				canSendTerminalInput: false,
				canSendStructuredPrompt: false,
				canSendStructuredCommand: false,
				reason: 'Print launch plans do not support live follow-up input.'
			},
			providerEnv: {
				ANTHROPIC_API_KEY: 'provider-key',
				SHARED: 'provider'
			},
			captureSessions: false
		});
		expect(launch).toEqual({
			mode: 'print',
			command: "claude --print --verbose --dangerously-skip-permissions --output-format stream-json --model 'claude-sonnet-4-7' --effort high --resume 'claude-session-42' -p -",
			args: [],
			stdin: 'Implement the provider adapter.',
			env: {
				PATH: '/usr/bin',
				ANTHROPIC_API_KEY: 'provider-key',
				MISSION_AGENT_SESSION_ID: 'agent-session-1',
				SHARED: 'launch'
			}
		});
		expect(usage).toEqual({
			kind: 'usage',
			payload: {
				inputTokens: 12,
				cacheCreationInputTokens: 3,
				cacheReadInputTokens: 4,
				outputTokens: 5
			}
		});
		expect(observations).toEqual([
			{
				kind: 'signal',
				signal: {
					type: 'provider-session',
					providerName: 'claude-code',
					sessionId: 'claude-session-42',
					source: 'provider-structured',
					confidence: 'high'
				}
			}
		]);
	});

	it('maps Pi exactly and preserves interactive argv plus print stdin', () => {
		const adapter = createAdapter('pi', {
			model: 'pi-large',
			launchMode: 'interactive',
			providerEnv: {
				PI_API_KEY: 'pi-key'
			},
			runtimeEnv: {
				PATH: '/usr/local/bin'
			},
			launchEnv: {
				MISSION_AGENT_SESSION_ID: 'agent-session-2'
			}
		});

		const initialization = adapter.initialize(createLaunchConfig());
		const interactiveLaunch = adapter.buildInteractiveLaunch(createLaunchConfig());
		const printLaunch = adapter.buildPrintLaunch(createLaunchConfig());
		const observations = adapter.parseRuntimeOutput(
			'{"type":"tool_execution_start","toolName":"Bash","args":{"command":"pnpm test"}}'
		);

		expect(initialization).toEqual({
			runnerId: 'pi',
			providerName: 'pi',
			model: 'pi-large',
			capabilities: {
				interactive: true,
				print: true,
				streamParsing: true,
				sessionCapture: false,
				sessionUsage: false
			},
			interactionCapabilities: {
				mode: 'pty-terminal',
				canSendTerminalInput: true,
				canSendStructuredPrompt: false,
				canSendStructuredCommand: false
			},
			providerEnv: {
				PI_API_KEY: 'pi-key'
			},
			captureSessions: false
		});
		expect(interactiveLaunch).toEqual({
			mode: 'interactive',
			command: 'pi',
			args: ['--model', 'pi-large', 'Implement the provider adapter.'],
			env: {
				PATH: '/usr/local/bin',
				PI_API_KEY: 'pi-key',
				MISSION_AGENT_SESSION_ID: 'agent-session-2'
			}
		});
		expect(printLaunch).toEqual({
			mode: 'print',
			command: "pi -p --mode json --no-session --model 'pi-large'",
			args: [],
			stdin: 'Implement the provider adapter.',
			env: {
				PATH: '/usr/local/bin',
				PI_API_KEY: 'pi-key',
				MISSION_AGENT_SESSION_ID: 'agent-session-2'
			}
		});
		expect(observations).toEqual([
			{
				kind: 'signal',
				signal: {
					type: 'tool-call',
					toolName: 'Bash',
					args: 'pnpm test',
					source: 'provider-structured',
					confidence: 'medium'
				}
			}
		]);
	});

	it('maps Codex exactly and carries the reasoning effort into the provider command', () => {
		const adapter = createAdapter('codex', {
			model: 'gpt-5-codex',
			launchMode: 'interactive',
			reasoningEffort: 'xhigh',
			providerEnv: {
				OPENAI_API_KEY: 'codex-key'
			}
		});

		const initialization = adapter.initialize(createLaunchConfig());
		const interactiveLaunch = adapter.buildInteractiveLaunch(createLaunchConfig());
		const printLaunch = adapter.buildPrintLaunch(createLaunchConfig());
		const observations = adapter.parseRuntimeOutput(
			'{"type":"item.completed","item":{"type":"agent_message","text":"Done."}}'
		);

		expect(initialization.capabilities).toEqual({
			interactive: true,
			print: true,
			streamParsing: true,
			sessionCapture: false,
			sessionUsage: false
		});
		expect(interactiveLaunch).toEqual({
			mode: 'interactive',
			command: 'codex',
			args: ['--model', 'gpt-5-codex', 'Implement the provider adapter.'],
			env: {
				OPENAI_API_KEY: 'codex-key'
			}
		});
		expect(printLaunch).toEqual({
			mode: 'print',
			command: `codex exec --json --dangerously-bypass-approvals-and-sandbox -m 'gpt-5-codex' -c 'model_reasoning_effort="xhigh"'`,
			args: [],
			stdin: 'Implement the provider adapter.',
			env: {
				OPENAI_API_KEY: 'codex-key'
			}
		});
		expect(observations).toEqual([
			{
				kind: 'message',
				channel: 'agent',
				text: 'Done.'
			},
			{
				kind: 'message',
				channel: 'agent',
				text: 'Done.'
			}
		]);
	});

	it('maps OpenCode exactly and reports absent structured stream parsing honestly', () => {
		const adapter = createAdapter('opencode', {
			model: 'opencode-1',
			launchMode: 'interactive',
			providerEnv: {
				OPENCODE_TOKEN: 'token'
			}
		});

		const initialization = adapter.initialize(createLaunchConfig());
		const interactiveLaunch = adapter.buildInteractiveLaunch(createLaunchConfig());
		const printLaunch = adapter.buildPrintLaunch(createLaunchConfig());
		const observations = adapter.parseRuntimeOutput('plain text without structured output');

		expect(initialization).toEqual({
			runnerId: 'opencode',
			providerName: 'opencode',
			model: 'opencode-1',
			capabilities: {
				interactive: true,
				print: true,
				streamParsing: false,
				sessionCapture: false,
				sessionUsage: false
			},
			interactionCapabilities: {
				mode: 'pty-terminal',
				canSendTerminalInput: true,
				canSendStructuredPrompt: false,
				canSendStructuredCommand: false
			},
			providerEnv: {
				OPENCODE_TOKEN: 'token'
			},
			captureSessions: false
		});
		expect(interactiveLaunch).toEqual({
			mode: 'interactive',
			command: 'opencode',
			args: ['--model', 'opencode-1', '-p', 'Implement the provider adapter.'],
			env: {
				OPENCODE_TOKEN: 'token'
			}
		});
		expect(printLaunch).toEqual({
			mode: 'print',
			command: "opencode run --model 'opencode-1' 'Implement the provider adapter.'",
			args: [],
			env: {
				OPENCODE_TOKEN: 'token'
			}
		});
		expect(observations).toEqual([{ kind: 'none' }]);
	});

	it('fails clearly when the model is missing', () => {
		const adapter = createAdapter('pi', {
			model: '   '
		});

		expect(() => adapter.initialize(createLaunchConfig())).toThrowError(
			new ProviderInitializationError(
				'pi',
				"Runner 'pi' requires a non-empty provider model."
			)
		);
	});

	it('fails clearly when no provider factory is registered', () => {
		const adapter = new AgentProviderAdapter({
			runnerId: 'pi',
			resolveSettings: () => ({
				model: 'pi-large',
				launchMode: 'interactive'
			})
		});
		Object.defineProperty(adapter, 'providerFactories', {
			value: {},
			configurable: true
		});

		expect(() => adapter.initialize(createLaunchConfig())).toThrowError(
			new ProviderInitializationError(
				'pi',
				"No provider factory is registered for 'pi'."
			)
		);
	});

	it('fails clearly when interactive launch is requested from a non-interactive provider', () => {
		const adapter = new AgentProviderAdapter({
			runnerId: 'pi',
			resolveSettings: () => ({
				model: 'pi-large',
				launchMode: 'interactive'
			}),
			providerFactories: {
				pi: () => ({
					name: 'pi',
					env: {},
					captureSessions: false,
					buildPrintCommand: () => ({ command: 'pi -p' }),
					parseStreamLine: () => []
				})
			}
		});

		expect(() => adapter.initialize(createLaunchConfig())).toThrowError(
			new UnsupportedCapabilityError(
				'pi',
				"Runner 'pi' does not support interactive launch plans."
			)
		);
	});

	it('fails clearly when a provider returns an empty print command', () => {
		const adapter = new AgentProviderAdapter({
			runnerId: 'codex',
			resolveSettings: () => ({
				model: 'gpt-5-codex',
				launchMode: 'print'
			}),
			providerFactories: {
				codex: () => ({
					name: 'codex',
					env: {},
					captureSessions: false,
					buildPrintCommand: () => ({ command: '   ', stdin: 'preserved' }),
					buildInteractiveArgs: () => ['codex'],
					parseStreamLine: () => []
				})
			}
		});

		adapter.initialize(createLaunchConfig());

		expect(() => adapter.buildPrintLaunch(createLaunchConfig())).toThrowError(
			new ProviderInitializationError(
				'codex',
				"Runner 'codex' returned an empty print command."
			)
		);
	});

	it('fails clearly when a provider returns an empty interactive argv', () => {
		const adapter = new AgentProviderAdapter({
			runnerId: 'codex',
			resolveSettings: () => ({
				model: 'gpt-5-codex',
				launchMode: 'interactive'
			}),
			providerFactories: {
				codex: () => ({
					name: 'codex',
					env: {},
					captureSessions: false,
					buildPrintCommand: () => ({ command: 'codex exec' }),
					buildInteractiveArgs: () => [],
					parseStreamLine: () => []
				})
			}
		});

		adapter.initialize(createLaunchConfig());

		expect(() => adapter.buildInteractiveLaunch(createLaunchConfig())).toThrowError(
			new ProviderInitializationError(
				'codex',
				"Runner 'codex' returned an empty interactive argv."
			)
		);
	});

	it('fails clearly when unsupported resume behavior is requested', () => {
		const adapter = createAdapter('claude-code', {
			model: 'claude-sonnet-4-7',
			launchMode: 'interactive',
			resumeSession: 'claude-session-42'
		});

		expect(() => adapter.initialize(createLaunchConfig())).toThrowError(
			new ProviderInitializationError(
				'claude-code',
				"Runner 'claude-code' does not support resumeSession for interactive launch plans."
			)
		);
	});
});
