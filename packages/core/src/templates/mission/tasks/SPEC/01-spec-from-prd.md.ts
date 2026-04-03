import type { MissionTaskTemplate } from '../../types.js';

export const SPEC_FROM_PRD_TASK_TEMPLATE: MissionTaskTemplate = {
	fileName: '01-spec-from-prd.md',
	subject: 'Spec From PRD',
	instruction:
		'​Read PRD.md and define the technical target in SPEC.md. The specification must describe the intended design, the key boundaries, and the concrete files that will change. Only modify SPEC.md in this task. Do not create PLAN.md, task files, or application code in this task.',
	agent: 'copilot'
};