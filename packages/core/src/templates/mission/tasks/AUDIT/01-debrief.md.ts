import type { MissionTaskTemplate } from '../../types.js';

export const DEBRIEF_TASK_TEMPLATE: MissionTaskTemplate = {
	fileName: '01-debrief.md',
	subject: 'Debrief',
	instruction:
		'Run the repo-wide end-to-end validation required for the mission. Record the simulator run results, residual risks, and release readiness in AUDIT.md.',
	agent: 'copilot'
};