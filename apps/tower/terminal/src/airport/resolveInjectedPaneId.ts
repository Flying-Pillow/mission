export function resolveInjectedPaneId(): number | undefined {
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