import {
	resolveMissionWorkspaceContext
} from '@flying-pillow/mission-core';
import type { MissionWorkspaceContext } from '@flying-pillow/mission-core';
import type { CommandContext } from './types.js';

export function resolveTowerWorkspaceContext(context: CommandContext): MissionWorkspaceContext {
	return resolveMissionWorkspaceContext(context.launchCwd, context.controlRoot);
}
