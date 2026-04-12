import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AirportSubstrateEffect } from './effects.js';
import type { AirportPaneState, AirportState, AirportSubstrateState, GateId } from './types.js';

const execFileAsync = promisify(execFile);

const GATE_DISPLAY_TITLES: Record<GateId, string> = {
	dashboard: 'MISSION',
	editor: 'EDITOR',
	agentSession: 'AGENT SESSION'
};

type TerminalManagerPaneMetadata = {
	id: number;
	title: string;
	tabId?: number;
	tab_id?: number;
	is_plugin: boolean;
	is_focused?: boolean;
	is_suppressed?: boolean;
};

type TerminalManagerExecutorResult = {
	stdout: string;
	stderr: string;
};

type TerminalManagerExecutor = (args: string[]) => Promise<TerminalManagerExecutorResult>;

export interface AirportSubstrateController {
	getState(): AirportSubstrateState;
	observe(state: AirportState): Promise<AirportSubstrateState>;
	applyEffects(effects: AirportSubstrateEffect[]): Promise<AirportSubstrateState>;
}

export type TerminalManagerSubstrateOptions = {
	sessionName: string;
	executor?: TerminalManagerExecutor;
	terminalBinary?: string;
};

export class TerminalManagerSubstrateController implements AirportSubstrateController {
	private state: AirportSubstrateState;
	private readonly executor: TerminalManagerExecutor;

	public constructor(options: TerminalManagerSubstrateOptions) {
		this.state = createDefaultTerminalManagerSubstrateState(options);
		const terminalBinary = options.terminalBinary?.trim() || process.env['MISSION_TERMINAL_BINARY']?.trim() || 'zellij';
		this.executor = options.executor ?? (async (args) => {
			const result = await execFileAsync(terminalBinary, args, {
				encoding: 'utf8',
				env: { ...process.env, ZELLIJ: undefined }
			});
			return {
				stdout: result.stdout,
				stderr: result.stderr
			};
		});
	}

	public getState(): AirportSubstrateState {
		return structuredClone(this.state);
	}

	public async observe(state: AirportState): Promise<AirportSubstrateState> {
		const now = new Date().toISOString();
		const panes = await this.listPanes().catch(() => undefined);
		this.state = panes
			? buildObservedState(state, panes, now)
			: buildDetachedState(state, now);
		return this.getState();
	}

	public async applyEffects(effects: AirportSubstrateEffect[]): Promise<AirportSubstrateState> {
		for (const effect of effects) {
			switch (effect.kind) {
				case 'focus-gate': {
					try {
						await this.executor([
							'--session',
							this.state.sessionName,
							'action',
							'focus-pane-id',
							toTerminalPaneReference(effect.paneId)
						]);
					} catch (error) {
						if (isAlreadyFocusedPaneError(error)) {
							continue;
						}
						throw error;
					}
					break;
				}
				case 'ensure-gate-pane': {
					await this.ensureAgentSessionPane();
					break;
				}
				case 'remove-gate-pane': {
					await this.removePane(toTerminalPaneReference(effect.paneId));
					break;
				}
			}
		}
		this.state = {
			...this.state,
			lastAppliedAt: new Date().toISOString()
		};
		return this.getState();
	}

	private async ensureAgentSessionPane(): Promise<void> {
		const panes = await this.listPanes();
		const existingAgentPane = panes.find((pane) => pane.title === GATE_DISPLAY_TITLES.agentSession && !pane.is_suppressed);
		if (existingAgentPane) {
			return;
		}

		const editorPane = panes.find((pane) => pane.title === GATE_DISPLAY_TITLES.editor && !pane.is_suppressed)
			?? panes.find((pane) => !pane.is_suppressed)
			?? panes[0];
		if (!editorPane) {
			throw new Error(`Unable to locate a target pane to create '${GATE_DISPLAY_TITLES.agentSession}'.`);
		}

		const controlRoot = process.env['MISSION_CONTROL_ROOT']?.trim()
			|| process.env['MISSION_SURFACE_PATH']?.trim()
			|| process.cwd();
		const missionEntry = path.join(controlRoot, 'mission');
		const launchCommand = [
			'env',
			'\'MISSION_GATE_ID=agentSession\'',
			shellEscape(`MISSION_TERMINAL_SESSION=${this.state.sessionName}`),
			shellEscape(missionEntry),
			'\'__airport-layout-runway-pane\''
		].join(' ');

		await this.executor([
			'--session',
			this.state.sessionName,
			'action',
			'new-pane',
			'--in-place',
			toTerminalPaneReference(editorPane.id),
			'--name',
			GATE_DISPLAY_TITLES.agentSession,
			'--cwd',
			controlRoot,
			'--',
			'sh',
			'-lc',
			`exec ${launchCommand}`
		]);
	}

	private async removePane(paneId: string): Promise<void> {
		const previouslyFocusedPane = await this.getFocusedPaneId();
		if (previouslyFocusedPane !== paneId) {
			await this.executor([
				'--session',
				this.state.sessionName,
				'action',
				'focus-pane-id',
				paneId
			]);
		}

		try {
			await this.executor([
				'--session',
				this.state.sessionName,
				'action',
				'close-pane'
			]);
		} finally {
			if (previouslyFocusedPane && previouslyFocusedPane !== paneId) {
				await this.executor([
					'--session',
					this.state.sessionName,
					'action',
					'focus-pane-id',
					previouslyFocusedPane
				]).catch(() => {
					// Best effort focus restoration.
				});
			}
		}
	}

	private async getFocusedPaneId(): Promise<string | undefined> {
		const panes = await this.listPanes();
		const focusedPane = panes.find((pane) => pane.is_focused);
		return focusedPane ? toTerminalPaneReference(focusedPane.id) : undefined;
	}

	private async listPanes(): Promise<TerminalManagerPaneMetadata[]> {
		const result = await this.executor([
			'--session',
			this.state.sessionName,
			'action',
			'list-panes',
			'--json',
			'--all'
		]);
		return (JSON.parse(result.stdout) as TerminalManagerPaneMetadata[]).filter((pane) => !pane.is_plugin);
	}
}

export class InMemoryTerminalManagerSubstrateController implements AirportSubstrateController {
	private state: AirportSubstrateState;

	public constructor(options: { sessionName: string }) {
		this.state = createDefaultTerminalManagerSubstrateState(options);
	}

	public getState(): AirportSubstrateState {
		return structuredClone(this.state);
	}

	public observe(_state: AirportState): Promise<AirportSubstrateState> {
		const now = new Date().toISOString();
		this.state = {
			...this.state,
			attached: true,
			lastObservedAt: now
		};
		return Promise.resolve(this.getState());
	}

	public applyEffects(effects: AirportSubstrateEffect[]): Promise<AirportSubstrateState> {
		const focusEffect = effects.find((effect) => effect.kind === 'focus-gate');
		this.state = {
			...this.state,
			...(focusEffect ? { observedFocusedPaneId: focusEffect.paneId } : {}),
			lastAppliedAt: new Date().toISOString()
		};
		return Promise.resolve(this.getState());
	}
}


export function createDefaultTerminalManagerSubstrateState(options: { sessionName: string }): AirportSubstrateState {
	const sessionName = options.sessionName.trim();
	if (!sessionName) {
		throw new Error('Airport substrate requires a repository-scoped terminal session name.');
	}

	return {
		kind: 'terminal-manager',
		sessionName,
		layoutIntent: 'mission-control-v1',
		attached: false,
		panesByGate: {}
	};
}

function buildObservedState(
	state: AirportState,
	panes: TerminalManagerPaneMetadata[],
	now: string
): AirportSubstrateState {
	const currentState = state.substrate;
	const focusedPaneId = panes.find((pane) => pane.is_focused)?.id;
	const panesByGate = Object.fromEntries(
		(Object.keys(GATE_DISPLAY_TITLES) as GateId[]).map((gateId) => {
			const expected = isGatePaneExpected(state, gateId);
			const currentPane = currentState.panesByGate[gateId];
			const pane = currentPane?.paneId !== undefined && currentPane.paneId >= 0
				? panes.find((candidate) => candidate.id === currentPane.paneId)
				: panes.find((candidate) => candidate.title === GATE_DISPLAY_TITLES[gateId]);
			return [
				gateId,
				pane
					? {
						paneId: pane.id,
						expected,
						exists: true,
						title: pane.title
					}
					: {
						paneId: currentPane?.paneId ?? -1,
						expected,
						exists: false,
						title: currentPane?.title ?? GATE_DISPLAY_TITLES[gateId]
					}
			] as const;
		})
	) as Partial<Record<GateId, AirportPaneState>>;

	return {
		...currentState,
		attached: true,
		panesByGate,
		...(currentState.lastAppliedAt ? { lastAppliedAt: currentState.lastAppliedAt } : {}),
		lastObservedAt: now,
		...(focusedPaneId !== undefined
			? { observedFocusedPaneId: focusedPaneId }
			: {})
	};
}

function buildDetachedState(state: AirportState, now: string): AirportSubstrateState {
	const currentState = state.substrate;
	return {
		kind: currentState.kind,
		sessionName: currentState.sessionName,
		layoutIntent: currentState.layoutIntent,
		attached: false,
		panesByGate: Object.fromEntries(
			(Object.keys(GATE_DISPLAY_TITLES) as GateId[]).map((gateId) => [
				gateId,
				{
					paneId: currentState.panesByGate[gateId]?.paneId ?? -1,
					expected: isGatePaneExpected(state, gateId),
					exists: false,
					title: currentState.panesByGate[gateId]?.title ?? GATE_DISPLAY_TITLES[gateId]
				}
			])
		) as Partial<Record<GateId, AirportPaneState>>,
		...(currentState.lastAppliedAt ? { lastAppliedAt: currentState.lastAppliedAt } : {}),
		lastObservedAt: now
	};
}

function toTerminalPaneReference(paneId: number): string {
	return `terminal_${String(paneId)}`;
}

function isAlreadyFocusedPaneError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes('already focused');
}

function isGatePaneExpected(state: AirportState, gateId: GateId): boolean {
	if (gateId === 'agentSession') {
		return state.gates.agentSession.targetKind === 'agentSession';
	}
	return true;
}

function shellEscape(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}
