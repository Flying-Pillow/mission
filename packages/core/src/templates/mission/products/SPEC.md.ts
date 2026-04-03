import { renderMissionTitle } from '../common.js';
import type { MissionProductTemplate } from '../types.js';

export const SPEC_TEMPLATE: MissionProductTemplate = {
	key: 'spec',
	body: (brief, branchRef) =>
		[
			`# SPEC: ${renderMissionTitle(brief)}`,
			'',
			`Branch: ${branchRef}`,
			'',
			'## Architecture',
			'',
			'- TODO: Describe the simplest design that satisfies PRD.md.',
			'',
			'## OOD Signatures',
			'',
			'- TODO: List the core types, signatures, and responsibilities.',
			'',
			'## File Matrix',
			'',
			'- TODO: List the exact files that must change and why.',
			''
		].join('\n')
};