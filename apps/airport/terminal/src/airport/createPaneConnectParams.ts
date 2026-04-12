type AirportPaneGateId = 'dashboard' | 'editor' | 'agentSession';

export function createPaneConnectParams(gateId: AirportPaneGateId, label: string) {
	const paneId = resolveInjectedPaneId();
	const terminalSessionName = process.env['MISSION_TERMINAL_SESSION']?.trim()
		|| process.env['MISSION_TERMINAL_SESSION_NAME']?.trim();
	return {
		gateId,
		label,
		panelProcessId: String(process.pid),
		...(paneId !== undefined ? { paneId } : {}),
		...(terminalSessionName ? { terminalSessionName } : {})
	};
}

function resolveInjectedPaneId(): number | undefined {
	const rawPaneId = process.env['ZELLIJ_PANE_ID']?.trim();
	if (!rawPaneId) {
		return undefined;
	}

	const paneId = Number.parseInt(rawPaneId, 10);
	if (!Number.isInteger(paneId) || paneId < 0) {
		return undefined;
	}

	return paneId;
}