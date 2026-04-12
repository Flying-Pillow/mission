import { describe, expect, it } from 'vitest';
import { planAirportSubstrateEffects } from './effects.js';
import type { AirportState } from './types.js';
import { TerminalManagerSubstrateController } from './terminal-manager.js';

describe('TerminalManagerSubstrateController', () => {
	it('discovers gate panes by title when pane ids are unknown', async () => {
		const executor = (args: string[]) => {
			if (args.includes('list-panes')) {
				return Promise.resolve({
					stdout: JSON.stringify([
						{ id: 0, title: 'MISSION', is_plugin: false, is_focused: false },
						{ id: 1, title: 'AGENT SESSION', is_plugin: false, is_focused: true },
						{ id: 2, title: 'EDITOR', is_plugin: false, is_focused: false }
					]),
					stderr: ''
				});
			}
			return Promise.resolve({ stdout: '', stderr: '' });
		};

		const controller = new TerminalManagerSubstrateController({
			sessionName: 'mission-mission',
			executor
		});
		const airportState = createAirportState({}, {
			dashboard: { paneId: -1, expected: true, exists: false, title: 'MISSION' },
			agentSession: { paneId: -1, expected: true, exists: false, title: 'AGENT SESSION' },
			editor: { paneId: -1, expected: true, exists: false, title: 'EDITOR' }
		});

		const observed = await controller.observe(airportState);

		expect(observed.panesByGate.agentSession).toMatchObject({
			paneId: 1,
			exists: true,
			title: 'AGENT SESSION'
		});
		expect(observed.observedFocusedPaneId).toBe(1);
	});

	it('observes terminal-manager panes without applying focus effects', async () => {
		const calls: string[][] = [];
		const executor = (args: string[]) => {
			calls.push(args);
			if (args.includes('list-panes')) {
				return Promise.resolve({
					stdout: JSON.stringify([
						{ id: 1, title: 'mission-dashboard', is_plugin: false, is_focused: true },
						{ id: 2, title: 'session-1', is_plugin: false, is_focused: false },
						{ id: 3, title: 'editor-pane', is_plugin: false, is_focused: false }
					]),
					stderr: ''
				});
			}
			return Promise.resolve({ stdout: '', stderr: '' });
		};

		const controller = new TerminalManagerSubstrateController({
			sessionName: 'mission-mission',
			executor
		});
		const airportState = createAirportState(
			{
				agentSession: { targetKind: 'agentSession', targetId: 'session-1', mode: 'control' }
			},
			{
				dashboard: { paneId: 1, expected: true, exists: true, title: 'MISSION' },
				agentSession: { paneId: 2, expected: true, exists: true, title: 'AGENT SESSION' },
				editor: { paneId: 3, expected: true, exists: true, title: 'EDITOR' }
			}
		);

		const observed = await controller.observe(airportState);

		expect(observed.attached).toBe(true);
		expect(observed.panesByGate.agentSession).toMatchObject({
			paneId: 2,
			exists: true,
			expected: true,
			title: 'session-1'
		});
		expect(calls.filter((args) => args.includes('focus-pane-id'))).toEqual([]);
	});

	it('applies planned focus effects through terminal-manager', async () => {
		const calls: string[][] = [];
		const executor = (args: string[]) => {
			calls.push(args);
			if (args.includes('list-panes')) {
				return Promise.resolve({
					stdout: JSON.stringify([
						{ id: 1, title: 'mission-dashboard', is_plugin: false, is_focused: true },
						{ id: 2, title: 'editor-pane', is_plugin: false, is_focused: false },
						{ id: 3, title: 'session-pane', is_plugin: false, is_focused: false }
					]),
					stderr: ''
				});
			}
			return Promise.resolve({ stdout: '', stderr: '' });
		};

		const controller = new TerminalManagerSubstrateController({
			sessionName: 'mission-mission',
			executor
		});
		const observed = await controller.observe(createAirportState({
			agentSession: { targetKind: 'agentSession', targetId: 'session-1', mode: 'control' }
		}, {
			dashboard: { paneId: 1, expected: true, exists: true, title: 'MISSION' },
			editor: { paneId: 2, expected: true, exists: true, title: 'EDITOR' },
			agentSession: { paneId: 3, expected: true, exists: true, title: 'AGENT SESSION' }
		}));
		const airportState = createAirportState();
		airportState.focus.intentGateId = 'editor';
		airportState.substrate = observed;

		await controller.applyEffects(planAirportSubstrateEffects(airportState));

		expect(calls).toContainEqual([
			'--session',
			'mission-mission',
			'action',
			'focus-pane-id',
			'terminal_2'
		]);
	});

	it('creates the agent-session gate pane when a session binding appears', async () => {
		const calls: string[][] = [];
		let includeAgentPane = false;
		const executor = (args: string[]) => {
			calls.push(args);
			if (args.includes('list-panes')) {
				return Promise.resolve({
					stdout: JSON.stringify([
						{ id: 1, title: 'MISSION', is_plugin: false, is_focused: true },
						{ id: 2, title: 'EDITOR', is_plugin: false, is_focused: false },
						...(includeAgentPane ? [{ id: 3, title: 'AGENT SESSION', is_plugin: false, is_focused: false }] : [])
					]),
					stderr: ''
				});
			}
			if (args.includes('new-pane')) {
				includeAgentPane = true;
				return Promise.resolve({ stdout: '', stderr: '' });
			}
			return Promise.resolve({ stdout: '', stderr: '' });
		};

		const controller = new TerminalManagerSubstrateController({
			sessionName: 'mission-mission',
			executor
		});
		const state = createAirportState({
			agentSession: { targetKind: 'agentSession', targetId: 'session-1', mode: 'control' }
		});

		await controller.observe(state);
		await controller.applyEffects(planAirportSubstrateEffects(state));

		expect(calls.some((args) => args.includes('new-pane') && args.includes('--in-place'))).toBe(true);
	});

	it('removes the agent-session gate pane when no session is selected', async () => {
		const calls: string[][] = [];
		const executor = (args: string[]) => {
			calls.push(args);
			if (args.includes('list-panes')) {
				return Promise.resolve({
					stdout: JSON.stringify([
						{ id: 1, title: 'MISSION', is_plugin: false, is_focused: false },
						{ id: 2, title: 'EDITOR', is_plugin: false, is_focused: true },
						{ id: 3, title: 'AGENT SESSION', is_plugin: false, is_focused: false }
					]),
					stderr: ''
				});
			}
			return Promise.resolve({ stdout: '', stderr: '' });
		};

		const controller = new TerminalManagerSubstrateController({
			sessionName: 'mission-mission',
			executor
		});
		const state = createAirportState({}, {
			dashboard: { paneId: 1, expected: true, exists: true, title: 'MISSION' },
			editor: { paneId: 2, expected: true, exists: true, title: 'EDITOR' },
			agentSession: { paneId: 3, expected: false, exists: true, title: 'AGENT SESSION' }
		});

		await controller.observe(state);
		await controller.applyEffects(planAirportSubstrateEffects(state));

		expect(calls).toContainEqual(['--session', 'mission-mission', 'action', 'close-pane']);
	});

	it('reports a detached substrate when pane listing fails', async () => {
		const calls: string[][] = [];
		const executor = (args: string[]) => {
			calls.push(args);
			if (args.includes('list-panes')) {
				return Promise.reject(new Error('terminal-manager unavailable'));
			}
			return Promise.resolve({ stdout: '', stderr: '' });
		};

		const controller = new TerminalManagerSubstrateController({
			sessionName: 'mission-mission',
			executor
		});

		const observed = await controller.observe(createAirportState());

		expect(observed.attached).toBe(false);
		expect(observed.panesByGate.dashboard).toMatchObject({ exists: false, expected: true, title: 'MISSION' });
	});
});

function createAirportState(
	overrides: Partial<AirportState['gates']> = {},
	panesByGate: AirportState['substrate']['panesByGate'] = {}
): AirportState {
	return {
		airportId: 'airport:test',
		repositoryId: 'repo',
		repositoryRootPath: '/tmp/repo',
		gates: {
			dashboard: { targetKind: 'repository', targetId: 'repo', mode: 'control' },
			editor: { targetKind: 'repository', targetId: 'repo', mode: 'view' },
			agentSession: { targetKind: 'empty' },
			...overrides
		},
		focus: {},
		clients: {},
		substrate: {
			kind: 'terminal-manager',
			sessionName: 'mission-mission',
			layoutIntent: 'mission-control-v1',
			attached: false,
			panesByGate
		}
	};
}