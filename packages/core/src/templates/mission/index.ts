import { renderMissionBriefBody } from './BRIEF.md.js';
import { AUDIT_TEMPLATE } from './products/AUDIT.md.js';
import { PLAN_TEMPLATE } from './products/PLAN.md.js';
import { PRD_TEMPLATE } from './products/PRD.md.js';
import { SPEC_TEMPLATE } from './products/SPEC.md.js';
import { VERIFICATION_TEMPLATE } from './products/VERIFICATION.md.js';
import { DEBRIEF_TASK_TEMPLATE } from './tasks/AUDIT/01-debrief.md.js';
import { TOUCHDOWN_TASK_TEMPLATE } from './tasks/AUDIT/02-touchdown.md.js';
import { PLAN_FROM_SPEC_TASK_TEMPLATE } from './tasks/PLAN/01-plan-from-spec.md.js';
import { PRD_FROM_BRIEF_TASK_TEMPLATE } from './tasks/PRD/01-prd-from-brief.md.js';
import { SPEC_FROM_PRD_TASK_TEMPLATE } from './tasks/SPEC/01-spec-from-prd.md.js';
import type { MissionStageTemplateDefinitions } from './types.js';

export type {
	MissionProductTemplate,
	MissionStageTemplateDefinition,
	MissionStageTemplateDefinitions,
	MissionTaskTemplate
} from './types.js';
export { renderMissionBriefBody };

export const MISSION_STAGE_TEMPLATE_DEFINITIONS: MissionStageTemplateDefinitions = {
	prd: {
		artifacts: [PRD_TEMPLATE],
		defaultTasks: [PRD_FROM_BRIEF_TASK_TEMPLATE]
	},
	spec: {
		artifacts: [SPEC_TEMPLATE],
		defaultTasks: [SPEC_FROM_PRD_TASK_TEMPLATE]
	},
	plan: {
		artifacts: [PLAN_TEMPLATE],
		defaultTasks: [PLAN_FROM_SPEC_TASK_TEMPLATE]
	},
	implementation: {
		artifacts: [],
		defaultTasks: []
	},
	verification: {
		artifacts: [VERIFICATION_TEMPLATE],
		defaultTasks: []
	},
	audit: {
		artifacts: [AUDIT_TEMPLATE],
		defaultTasks: [DEBRIEF_TASK_TEMPLATE, TOUCHDOWN_TASK_TEMPLATE]
	}
};