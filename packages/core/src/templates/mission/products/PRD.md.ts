import { renderMissionTitle } from '../common.js';
import type { MissionProductTemplate } from '../types.js';

export const PRD_TEMPLATE: MissionProductTemplate = {
	key: 'prd',
	body: (brief, branchRef) =>
		[
			`# PRD: ${renderMissionTitle(brief)}`,
			'',
			`Branch: ${branchRef}`,
			'',
			'## Outcome',
			'',
			'- TODO: State the exact product outcome this mission must achieve.',
			'',
			'## Problem Statement',
			'',
			'- TODO: Describe the user or system problem in concrete terms.',
			'',
			'## Success Criteria',
			'',
			'- TODO: Record the measurable conditions that make the mission done.',
			'',
			'## Constraints',
			'',
			'- TODO: Record architecture, runtime, and delivery constraints.',
			'',
			'## Non-Goals',
			'',
			'- TODO: State what is explicitly out of scope.',
			''
		].join('\n')
};