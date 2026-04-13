const DEFAULT_TOWER_WIDTH_PERCENT = 56;
const SIDE_BY_SIDE_COMPANION_MIN_COLUMNS = 220;

export function buildAirportBootstrapLayout(input: {
	repoRoot: string;
	towerCommand: string;
	briefingRoomCommand: string;
	towerWidthPercent?: number;
}): string {
	const towerWidthPercent = normalizePercent(input.towerWidthPercent);
	const rightColumnWidthPercent = 100 - towerWidthPercent;
	return `layout {
	default_tab_template {
		children
	}
	tab name="TOWER" {
		pane split_direction="horizontal" {
			pane name="TOWER" focus=true size="${towerWidthPercent}%" command="sh" cwd="${kdlEscape(input.repoRoot)}" {
				args "-lc" "${kdlEscape(`exec ${input.towerCommand}`)}"
			}
			pane name="BRIEFING ROOM" size="${rightColumnWidthPercent}%" command="sh" cwd="${kdlEscape(input.repoRoot)}" {
				args "-lc" "${kdlEscape(`exec ${input.briefingRoomCommand}`)}"
			}
		}
	}
}
`;
}

export function resolveAirportCompanionPaneDirection(viewportColumns: number | undefined): 'down' | 'right' {
	return typeof viewportColumns === 'number' && Number.isFinite(viewportColumns) && viewportColumns >= SIDE_BY_SIDE_COMPANION_MIN_COLUMNS
		? 'right'
		: 'down';
}

function normalizePercent(value: number | undefined): number {
	const normalizedValue = typeof value === 'number' && Number.isFinite(value)
		? Math.round(value)
		: DEFAULT_TOWER_WIDTH_PERCENT;
	return Math.max(20, Math.min(80, normalizedValue));
}

function kdlEscape(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
}
