import { towerTheme } from '../towerTheme.js';
import type { ProgressRailItemState } from './headerDomain.js';

type ProgressStateTone = ProgressRailItemState | 'todo';

export function progressStateTone(state: ProgressStateTone): string {
	if (state === 'done') {
		return towerTheme.success;
	}
	if (state === 'active') {
		return towerTheme.accent;
	}
	if (state === 'blocked') {
		return towerTheme.warning;
	}
	return towerTheme.secondaryText;
}

export function progressConnectorTone(state: ProgressStateTone): string {
	if (state === 'done') {
		return towerTheme.success;
	}
	if (state === 'active') {
		return towerTheme.accent;
	}
	if (state === 'blocked') {
		return towerTheme.warning;
	}
	return towerTheme.borderMuted;
}