import { renderMissionTitle } from '../common.js';
import type { MissionProductTemplate } from '../types.js';

export const VERIFICATION_TEMPLATE: MissionProductTemplate = {
	key: 'verification',
	body: (brief, branchRef) =>
		[
			`# VERIFICATION: ${renderMissionTitle(brief)}`,
			'',
			`Branch: ${branchRef}`,
			'',
			'## Unit Test Evidence',
			'',
			'- TODO: Aggregate the focused verification logs for completed implementation tasks.',
			'',
			'## Gaps',
			'',
			'- TODO: Record verification gaps that must be resolved before audit.',
			''
		].join('\n')
};