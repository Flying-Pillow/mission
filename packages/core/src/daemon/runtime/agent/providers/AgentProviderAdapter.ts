import {
	claudeCode,
	codex,
	opencode,
	pi,
	type AgentProvider,
	type ClaudeCodeOptions,
	type CodexOptions,
	type OpenCodeOptions,
	type PiOptions
} from '@ai-hero/sandcastle';
import type { AgentLaunchConfig, AgentMetadata } from '../AgentRuntimeTypes.js';

export type AgentProviderRunnerId = 'claude-code' | 'pi' | 'codex' | 'opencode';
export type AgentProviderLaunchMode = 'interactive' | 'print';

export type AgentProviderCapabilities = {
	interactive: boolean;
	print: boolean;
	streamParsing: boolean;
	sessionCapture: boolean;
	sessionUsage: boolean;
};

export type AgentSessionInteractionMode = 'pty-terminal' | 'agent-message' | 'read-only';

export type AgentSessionInteractionCapabilities = {
	mode: AgentSessionInteractionMode;
	canSendTerminalInput: boolean;
	canSendStructuredPrompt: boolean;
	canSendStructuredCommand: boolean;
	reason?: string;
};

export type AgentProviderLaunchPlan = {
	mode: AgentProviderLaunchMode;
	command: string;
	args: string[];
	stdin?: string;
	env?: NodeJS.ProcessEnv;
};

export type AgentProviderSignal =
	| {
		type: 'provider-session';
		providerName: string;
		sessionId: string;
		source: 'provider-structured';
		confidence: 'high';
	}
	| {
		type: 'tool-call';
		toolName: string;
		args: string;
		source: 'provider-structured';
		confidence: 'medium';
	};

export type AgentProviderObservation =
	| { kind: 'message'; channel: 'agent' | 'system'; text: string }
	| { kind: 'signal'; signal: AgentProviderSignal }
	| { kind: 'usage'; payload: AgentMetadata }
	| { kind: 'none' };

export type AgentProviderInitialization = {
	runnerId: AgentProviderRunnerId;
	providerName: string;
	model: string;
	capabilities: AgentProviderCapabilities;
	interactionCapabilities: AgentSessionInteractionCapabilities;
	providerEnv: Record<string, string>;
	captureSessions: boolean;
};

export type AgentProviderSettings = {
	model: string;
	launchMode?: AgentProviderLaunchMode;
	reasoningEffort?: string;
	dangerouslySkipPermissions?: boolean;
	resumeSession?: string;
	captureSessions?: boolean;
	providerEnv?: Record<string, string>;
	runtimeEnv?: NodeJS.ProcessEnv;
	launchEnv?: Record<string, string>;
};

export type AgentProviderSettingsResolver = (
	config: AgentLaunchConfig,
	runnerId: AgentProviderRunnerId
) => AgentProviderSettings;

type ProviderFactoryMap = Record<AgentProviderRunnerId, (settings: ResolvedProviderSettings) => AgentProvider>;

type ResolvedProviderSettings = {
	model: string;
	launchMode: AgentProviderLaunchMode;
	reasoningEffort?: string;
	dangerouslySkipPermissions: boolean;
	resumeSession?: string;
	captureSessions?: boolean;
	providerEnv: Record<string, string>;
	runtimeEnv: NodeJS.ProcessEnv;
	launchEnv: Record<string, string>;
};

type ProviderParsedStreamEvent = ReturnType<AgentProvider['parseStreamLine']>[number];
type ClaudeCodeEffort = NonNullable<ClaudeCodeOptions['effort']>;
type CodexEffort = NonNullable<CodexOptions['effort']>;

type InitializedProviderState = {
	provider: AgentProvider;
	settings: ResolvedProviderSettings;
	initialization: AgentProviderInitialization;
};

const STREAM_PARSING_BY_RUNNER: Record<AgentProviderRunnerId, boolean> = {
	'claude-code': true,
	pi: true,
	codex: true,
	opencode: false
};

const DEFAULT_PROVIDER_FACTORIES: ProviderFactoryMap = {
	'claude-code': (settings) => {
		const options = {
			env: settings.providerEnv,
			...(settings.reasoningEffort
				? { effort: settings.reasoningEffort as ClaudeCodeEffort }
				: {}),
			...(settings.captureSessions !== undefined
				? { captureSessions: settings.captureSessions }
				: {})
		} satisfies ClaudeCodeOptions;
		return claudeCode(settings.model, options);
	},
	pi: (settings) => {
		const options: PiOptions = { env: settings.providerEnv };
		return pi(settings.model, options);
	},
	codex: (settings) => {
		const options = {
			env: settings.providerEnv,
			...(settings.reasoningEffort
				? { effort: settings.reasoningEffort as CodexEffort }
				: {})
		} satisfies CodexOptions;
		return codex(settings.model, options);
	},
	opencode: (settings) => {
		const options: OpenCodeOptions = { env: settings.providerEnv };
		return opencode(settings.model, options);
	}
};

export class AgentProviderError extends Error {
	public readonly runnerId: AgentProviderRunnerId;
	public readonly code: 'provider-initialization-error' | 'unsupported-capability';

	public constructor(
		code: 'provider-initialization-error' | 'unsupported-capability',
		runnerId: AgentProviderRunnerId,
		message: string
	) {
		super(message);
		this.name = code === 'unsupported-capability' ? 'UnsupportedCapabilityError' : 'ProviderInitializationError';
		this.code = code;
		this.runnerId = runnerId;
	}
}

export class ProviderInitializationError extends AgentProviderError {
	public constructor(runnerId: AgentProviderRunnerId, message: string) {
		super('provider-initialization-error', runnerId, message);
	}
}

export class UnsupportedCapabilityError extends AgentProviderError {
	public constructor(runnerId: AgentProviderRunnerId, message: string) {
		super('unsupported-capability', runnerId, message);
	}
}

export class AgentProviderAdapter {
	private readonly runnerIdValue: AgentProviderRunnerId;

	private readonly resolveSettings: AgentProviderSettingsResolver;

	private readonly providerFactories: ProviderFactoryMap;

	private state: InitializedProviderState | undefined;

	public constructor(options: {
		runnerId: AgentProviderRunnerId;
		resolveSettings: AgentProviderSettingsResolver;
		providerFactories?: Partial<ProviderFactoryMap>;
	}) {
		this.runnerIdValue = options.runnerId;
		this.resolveSettings = options.resolveSettings;
		this.providerFactories = {
			...DEFAULT_PROVIDER_FACTORIES,
			...(options.providerFactories ?? {})
		};
	}

	public get runnerId(): AgentProviderRunnerId {
		return this.runnerIdValue;
	}

	public get label(): string {
		return `${this.runnerIdValue} provider adapter`;
	}

	public initialize(config: AgentLaunchConfig): AgentProviderInitialization {
		const settings = this.resolveProviderSettings(config);
		const providerFactory = this.providerFactories[this.runnerIdValue];
		if (!providerFactory) {
			throw new ProviderInitializationError(
				this.runnerIdValue,
				`No provider factory is registered for '${this.runnerIdValue}'.`
			);
		}
		const provider = providerFactory(settings);
		validateProviderEnv(this.runnerIdValue, provider.env, 'provider.env');
		const capabilities = resolveCapabilities(this.runnerIdValue, provider);
		if (settings.launchMode === 'interactive' && !provider.buildInteractiveArgs) {
			throw new UnsupportedCapabilityError(
				this.runnerIdValue,
				`Runner '${this.runnerIdValue}' does not support interactive launch plans.`
			);
		}
		const initialization: AgentProviderInitialization = {
			runnerId: this.runnerIdValue,
			providerName: provider.name,
			model: settings.model,
			capabilities,
			interactionCapabilities: resolveInteractionCapabilities(settings.launchMode),
			providerEnv: { ...provider.env },
			captureSessions: provider.captureSessions
		};
		this.state = {
			provider,
			settings,
			initialization
		};
		return cloneInitialization(initialization);
	}

	public getCapabilities(): AgentProviderCapabilities {
		return cloneCapabilities(this.requireInitializedState().initialization.capabilities);
	}

	public buildInteractiveLaunch(config: AgentLaunchConfig): AgentProviderLaunchPlan {
		const state = this.requireInitializedState();
		const prompt = resolvePrompt(config);
		if (state.settings.resumeSession) {
			throw new UnsupportedCapabilityError(
				this.runnerIdValue,
				`Runner '${this.runnerIdValue}' does not support interactive resume sessions.`
			);
		}
		if (!state.provider.buildInteractiveArgs) {
			throw new UnsupportedCapabilityError(
				this.runnerIdValue,
				`Runner '${this.runnerIdValue}' does not support interactive launch plans.`
			);
		}
		const argv = state.provider.buildInteractiveArgs({
			prompt,
			dangerouslySkipPermissions: state.settings.dangerouslySkipPermissions
		});
		const [command, ...args] = validateInteractiveArgv(this.runnerIdValue, argv);
		return {
			mode: 'interactive',
			command,
			args,
			env: mergeLaunchEnv(state.settings.runtimeEnv, state.provider.env, state.settings.launchEnv)
		};
	}

	public buildPrintLaunch(config: AgentLaunchConfig): AgentProviderLaunchPlan {
		const state = this.requireInitializedState();
		const prompt = resolvePrompt(config);
		const printCommand = state.provider.buildPrintCommand({
			prompt,
			dangerouslySkipPermissions: state.settings.dangerouslySkipPermissions,
			...(state.settings.resumeSession
				? { resumeSession: state.settings.resumeSession }
				: {})
		});
		const command = printCommand.command.trim();
		if (!command) {
			throw new ProviderInitializationError(
				this.runnerIdValue,
				`Runner '${this.runnerIdValue}' returned an empty print command.`
			);
		}
		return {
			mode: 'print',
			command,
			args: [],
			...(printCommand.stdin !== undefined ? { stdin: printCommand.stdin } : {}),
			env: mergeLaunchEnv(state.settings.runtimeEnv, state.provider.env, state.settings.launchEnv)
		};
	}

	public parseRuntimeOutput(line: string): AgentProviderObservation[] {
		const events = this.requireInitializedState().provider.parseStreamLine(line);
		if (events.length === 0) {
			return [{ kind: 'none' }];
		}
		return events.map((event) => mapParsedStreamEvent(this.requireInitializedState().provider.name, event));
	}

	public parseSessionUsage(content: string): AgentProviderObservation | undefined {
		const provider = this.requireInitializedState().provider;
		const usage = provider.parseSessionUsage?.(content);
		if (!usage) {
			return undefined;
		}
		return {
			kind: 'usage',
			payload: {
				inputTokens: usage.inputTokens,
				cacheCreationInputTokens: usage.cacheCreationInputTokens,
				cacheReadInputTokens: usage.cacheReadInputTokens,
				outputTokens: usage.outputTokens
			}
		};
	}

	private resolveProviderSettings(config: AgentLaunchConfig): ResolvedProviderSettings {
		const raw = this.resolveSettings(config, this.runnerIdValue);
		const model = raw.model?.trim();
		if (!model) {
			throw new ProviderInitializationError(
				this.runnerIdValue,
				`Runner '${this.runnerIdValue}' requires a non-empty provider model.`
			);
		}
		const launchMode = raw.launchMode ?? 'interactive';
		validateLaunchMode(this.runnerIdValue, launchMode);
		validateReasoningEffort(this.runnerIdValue, raw.reasoningEffort);
		validateCaptureSessions(this.runnerIdValue, raw.captureSessions);
		validateDangerouslySkipPermissions(this.runnerIdValue, raw.dangerouslySkipPermissions);
		validateResumeSession(this.runnerIdValue, launchMode, raw.resumeSession);
		return {
			model,
			launchMode,
			...(raw.reasoningEffort ? { reasoningEffort: raw.reasoningEffort } : {}),
			dangerouslySkipPermissions: raw.dangerouslySkipPermissions ?? false,
			...(raw.resumeSession?.trim() ? { resumeSession: raw.resumeSession.trim() } : {}),
			...(raw.captureSessions !== undefined ? { captureSessions: raw.captureSessions } : {}),
			providerEnv: validateProviderEnv(
				this.runnerIdValue,
				raw.providerEnv ?? {},
				'resolved provider env'
			),
			runtimeEnv: sanitizeProcessEnv(raw.runtimeEnv),
			launchEnv: validateProviderEnv(this.runnerIdValue, raw.launchEnv ?? {}, 'launch env')
		};
	}

	private requireInitializedState(): InitializedProviderState {
		if (!this.state) {
			throw new ProviderInitializationError(
				this.runnerIdValue,
				`Runner '${this.runnerIdValue}' must be initialized before building launch plans or parsing observations.`
			);
		}
		return this.state;
	}
}

function cloneInitialization(initialization: AgentProviderInitialization): AgentProviderInitialization {
	return {
		...initialization,
		capabilities: cloneCapabilities(initialization.capabilities),
		interactionCapabilities: { ...initialization.interactionCapabilities },
		providerEnv: { ...initialization.providerEnv }
	};
}

function cloneCapabilities(capabilities: AgentProviderCapabilities): AgentProviderCapabilities {
	return { ...capabilities };
}

function resolveCapabilities(
	runnerId: AgentProviderRunnerId,
	provider: AgentProvider
): AgentProviderCapabilities {
	return {
		interactive: typeof provider.buildInteractiveArgs === 'function',
		print: true,
		streamParsing: STREAM_PARSING_BY_RUNNER[runnerId],
		sessionCapture: provider.captureSessions,
		sessionUsage: typeof provider.parseSessionUsage === 'function'
	};
}

function resolveInteractionCapabilities(
	launchMode: AgentProviderLaunchMode
): AgentSessionInteractionCapabilities {
	if (launchMode === 'interactive') {
		return {
			mode: 'pty-terminal',
			canSendTerminalInput: true,
			canSendStructuredPrompt: false,
			canSendStructuredCommand: false
		};
	}
	return {
		mode: 'read-only',
		canSendTerminalInput: false,
		canSendStructuredPrompt: false,
		canSendStructuredCommand: false,
		reason: 'Print launch plans do not support live follow-up input.'
	};
}

function validateLaunchMode(runnerId: AgentProviderRunnerId, value: string): asserts value is AgentProviderLaunchMode {
	if (value !== 'interactive' && value !== 'print') {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' received unsupported launch mode '${value}'.`
		);
	}
}

function validateReasoningEffort(runnerId: AgentProviderRunnerId, value: string | undefined): void {
	if (value === undefined) {
		return;
	}
	const allowedValues = runnerId === 'claude-code'
		? ['low', 'medium', 'high', 'max']
		: runnerId === 'codex'
			? ['low', 'medium', 'high', 'xhigh']
			: undefined;
	if (!allowedValues) {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' does not support a reasoning effort option.`
		);
	}
	if (!allowedValues.includes(value)) {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' received unsupported reasoning effort '${value}'.`
		);
	}
}

function validateCaptureSessions(runnerId: AgentProviderRunnerId, value: boolean | undefined): void {
	if (value === undefined) {
		return;
	}
	if (runnerId !== 'claude-code' && value) {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' does not support enabling session capture.`
		);
	}
}

function validateDangerouslySkipPermissions(
	runnerId: AgentProviderRunnerId,
	value: boolean | undefined
): void {
	if (!value) {
		return;
	}
	if (runnerId !== 'claude-code') {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' does not support configurable permission bypass.`
		);
	}
}

function validateResumeSession(
	runnerId: AgentProviderRunnerId,
	launchMode: AgentProviderLaunchMode,
	value: string | undefined
): void {
	const trimmed = value?.trim();
	if (!trimmed) {
		return;
	}
	if (launchMode !== 'print' || runnerId !== 'claude-code') {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' does not support resumeSession for ${launchMode} launch plans.`
		);
	}
}

function validateProviderEnv(
	runnerId: AgentProviderRunnerId,
	value: Record<string, string> | undefined,
	label: string
): Record<string, string> {
	if (value === undefined) {
		return {};
	}
	if (!isRecord(value)) {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' requires ${label} to be a string record.`
		);
	}
	const env: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry !== 'string') {
			throw new ProviderInitializationError(
				runnerId,
				`Runner '${runnerId}' requires ${label}['${key}'] to be a string.`
			);
		}
		env[key] = entry;
	}
	return env;
}

function sanitizeProcessEnv(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
	const normalized: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(env ?? {})) {
		if (typeof value === 'string') {
			normalized[key] = value;
		}
	}
	return normalized;
}

function mergeLaunchEnv(
	runtimeEnv: NodeJS.ProcessEnv,
	providerEnv: Record<string, string>,
	launchEnv: Record<string, string>
): NodeJS.ProcessEnv {
	return {
		...runtimeEnv,
		...providerEnv,
		...launchEnv
	};
}

function validateInteractiveArgv(runnerId: AgentProviderRunnerId, argv: string[]): [string, ...string[]] {
	if (!Array.isArray(argv) || argv.length === 0) {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' returned an empty interactive argv.`
		);
	}
	const [command, ...args] = argv;
	if (typeof command !== 'string' || !command.trim()) {
		throw new ProviderInitializationError(
			runnerId,
			`Runner '${runnerId}' returned an invalid interactive command.`
		);
	}
	return [command.trim(), ...args];
}

function resolvePrompt(config: AgentLaunchConfig): string {
	return config.initialPrompt?.text ?? '';
}

function mapParsedStreamEvent(
	providerName: string,
	event: ProviderParsedStreamEvent
): AgentProviderObservation {
	switch (event.type) {
		case 'text':
			return {
				kind: 'message',
				channel: 'agent',
				text: event.text
			};
		case 'result':
			return {
				kind: 'message',
				channel: 'agent',
				text: event.result
			};
		case 'tool_call':
			return {
				kind: 'signal',
				signal: {
					type: 'tool-call',
					toolName: event.name,
					args: event.args,
					source: 'provider-structured',
					confidence: 'medium'
				}
			};
		case 'session_id':
			return {
				kind: 'signal',
				signal: {
					type: 'provider-session',
					providerName,
					sessionId: event.sessionId,
					source: 'provider-structured',
					confidence: 'high'
				}
			};
	}
	return assertUnreachableParsedStreamEvent(event);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertUnreachableParsedStreamEvent(event: never): never {
	throw new Error(`Unsupported provider parsed stream event: ${JSON.stringify(event)}`);
}
