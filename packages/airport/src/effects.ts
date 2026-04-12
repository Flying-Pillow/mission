import type { AirportState, AirportSubstrateState, GateId } from './types.js';

export type AirportSubstrateEffect = {
	kind: 'focus-gate';
	gateId: GateId;
	paneId: number;
} | {
	kind: 'ensure-gate-pane';
	gateId: 'agentSession';
} | {
	kind: 'remove-gate-pane';
	gateId: 'agentSession';
	paneId: number;
};

export function planAirportSubstrateEffects(state: AirportState): AirportSubstrateEffect[] {
	const effects: AirportSubstrateEffect[] = [];
	const agentSessionBinding = state.gates.agentSession;
	const agentSessionPane = state.substrate.panesByGate.agentSession;
	const shouldShowAgentSessionPane = agentSessionBinding.targetKind === 'agentSession';
	const hasAgentSessionPane = Boolean(agentSessionPane?.exists && (agentSessionPane.paneId ?? -1) >= 0);

	if (shouldShowAgentSessionPane && !hasAgentSessionPane) {
		effects.push({ kind: 'ensure-gate-pane', gateId: 'agentSession' });
	}

	if (!shouldShowAgentSessionPane && hasAgentSessionPane && (agentSessionPane?.paneId ?? -1) >= 0) {
		effects.push({
			kind: 'remove-gate-pane',
			gateId: 'agentSession',
			paneId: agentSessionPane?.paneId ?? -1
		});
	}

	const intentGateId = state.focus.intentGateId;
	if (!intentGateId) {
		return effects;
	}

	const observedGateId = resolveObservedGateIdFromSubstrate(state.substrate) ?? state.focus.observedGateId;
	if (observedGateId === intentGateId) {
		return effects;
	}

	const pane = state.substrate.panesByGate[intentGateId];
	if (!pane?.exists || pane.paneId < 0) {
		return effects;
	}

	effects.push({ kind: 'focus-gate', gateId: intentGateId, paneId: pane.paneId });
	return effects;
}

export function resolveObservedGateIdFromSubstrate(substrate: AirportSubstrateState): GateId | undefined {
	if (substrate.observedFocusedPaneId === undefined) {
		return undefined;
	}

	for (const [gateId, pane] of Object.entries(substrate.panesByGate) as Array<[GateId, AirportSubstrateState['panesByGate'][GateId]]>) {
		if (pane?.exists && pane.paneId === substrate.observedFocusedPaneId) {
			return gateId;
		}
	}

	return undefined;
}