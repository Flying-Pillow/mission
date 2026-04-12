import {
	resolveMissionWorkspaceContext
} from '@flying-pillow/mission-core';
import type { MissionWorkspaceContext } from '@flying-pillow/mission-core';
import type { EntryContext } from '../entry/entryContext.js';

export function resolveTowerWorkspaceContext(context: EntryContext): MissionWorkspaceContext {
	return resolveMissionWorkspaceContext(context.launchCwd, context.controlRoot);
}