import { renderMissionTitle } from '../common.js';
import type { MissionProductTemplate } from '../types.js';

export const AUDIT_TEMPLATE: MissionProductTemplate = {
	key: 'audit',
	body: (brief, branchRef) =>
		[
			`# AUDIT: ${renderMissionTitle(brief)}`,
			'',
			`Branch: ${branchRef}`,
			'',
			'## Findings',
			'',
			'- TODO: Record simulator and end-to-end findings.',
			'',
			'## Risks',
			'',
			'- TODO: Record residual risks.',
			'',
			'## PR Checklist',
			'',
			'- TODO: Record final delivery readiness and PR checklist items.',
			''
		].join('\n')
};