import { describe, expect, it } from 'vitest';
import { AirportControl } from './AirportControl.js';
import type { AirportSubstrateState } from './types.js';

describe('AirportControl', () => {
	it('reconciles observed focus from substrate pane observations', () => {
		const control = new AirportControl({
			airportId: 'airport:test',
			repositoryId: 'repo',
			repositoryRootPath: '/tmp/repo',
			terminalSessionName: 'mission-control-repo-test'
		});

		control.connectClient({
			clientId: 'dashboard',
			gateId: 'dashboard',
			paneId: 1
		});

		control.observeClient({
			clientId: 'dashboard',
			focusedGateId: 'dashboard'
		});

		const substrate: AirportSubstrateState = {
			kind: 'terminal-manager',
			sessionName: 'mission-control',
			layoutIntent: 'mission-control-v1',
			attached: true,
			observedFocusedPaneId: 2,
			panesByGate: {
				dashboard: { paneId: 1, expected: true, exists: true, title: 'mission-dashboard' },
				editor: { paneId: 2, expected: true, exists: true, title: 'EDITOR' },
				agentSession: { paneId: 3, expected: true, exists: true, title: 'AGENT SESSION' }
			}
		};

		control.observeSubstrate(substrate);

		expect(control.getState().focus).toMatchObject({ observedGateId: 'editor' });
	});
});