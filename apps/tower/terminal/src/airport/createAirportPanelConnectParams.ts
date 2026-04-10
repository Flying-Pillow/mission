import { resolveInjectedPaneId } from './resolveInjectedPaneId.js';

type AirportPanelGateId = 'dashboard' | 'editor' | 'agentSession';

export function createAirportPanelConnectParams(gateId: AirportPanelGateId, label: string) {
	const paneId = resolveInjectedPaneId();
	return {
		gateId,
		label,
		panelProcessId: String(process.pid),
		...(paneId !== undefined ? { paneId } : {})
	};
}