import type { MissionTaskTemplate } from '../../types.js';

export const TOUCHDOWN_TASK_TEMPLATE: MissionTaskTemplate = {
	fileName: '02-touchdown.md',
	subject: 'Touchdown',
	instruction:
		'Prepare the final delivery motion. Confirm AUDIT.md is complete, summarize the final status, and trigger the governed delivery flow for this mission.',
	agent: 'copilot'
};