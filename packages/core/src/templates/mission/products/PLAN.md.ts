import { renderMissionTitle } from '../common.js';
import type { MissionProductTemplate } from '../types.js';

export const PLAN_TEMPLATE: MissionProductTemplate = {
	key: 'plan',
	body: (brief, branchRef) =>
		[
			`# PLAN: ${renderMissionTitle(brief)}`,
			'',
			`Branch: ${branchRef}`,
			'',
			'## Strategy',
			'',
			'- TODO: Describe the mission strategy at a high level.',
			'',
			'## Task Slices',
			'',
			'- TODO: Enumerate the implementation tasks that should be created under tasks/IMPLEMENTATION.',
			'',
			'## Verification Slices',
			'',
			'- TODO: Enumerate the verification tasks that should be created under tasks/VERIFICATION.',
			'',
			'## Execution Notes',
			'',
			'- TODO: Record planner assumptions, sequencing, and checkpoints.',
			''
		].join('\n')
};