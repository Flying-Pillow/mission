import type { MissionBrief } from '../../types.js';

export function renderMissionTitle(brief: MissionBrief): string {
	return brief.issueId !== undefined ? `#${String(brief.issueId)} - ${brief.title}` : brief.title;
}