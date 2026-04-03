import type { MissionBrief } from '../../types.js';
import { renderMissionTitle } from './common.js';

export function renderMissionBriefBody(brief: MissionBrief): string {
	return [
		`# BRIEF: ${renderMissionTitle(brief)}`,
		'',
		brief.issueId !== undefined ? `Issue: #${String(brief.issueId)}` : 'Issue: Unattached',
		'',
		brief.body.trim()
	].join('\n');
}