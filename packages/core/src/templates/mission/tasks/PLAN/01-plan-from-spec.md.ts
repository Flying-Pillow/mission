import type { MissionTaskTemplate } from '../../types.js';

export const PLAN_FROM_SPEC_TASK_TEMPLATE: MissionTaskTemplate = {
	fileName: '01-plan-from-spec.md',
	subject: 'Plan From Spec',
	instruction:
		'​Read SPEC.md and write PLAN.md as the execution contract for the rest of the mission. Break the work into concrete implementation and verification tasks by physically creating the numbered markdown task files in tasks/IMPLEMENTATION and tasks/VERIFICATION. Only modify PLAN.md and the task markdown files you create under tasks/IMPLEMENTATION and tasks/VERIFICATION. Do not create application code, and do not edit index.html, styles.css, script.js, or any other implementation artifact in this task.',
	agent: 'planner'
};