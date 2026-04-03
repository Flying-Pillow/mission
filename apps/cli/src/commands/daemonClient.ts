import type {
	MissionSelector
} from '@flying-pillow/mission-core';
import {
	connectDaemonClient,
	Mission,
	resolveDaemonLaunchModeFromModule
} from '@flying-pillow/mission-core';
import type { CommandContext, ParsedFlagMap } from './types.js';

export async function withMissionClient<TResult>(
	context: CommandContext,
	callback: (mission: Mission) => Promise<TResult>
): Promise<TResult> {
	const daemonClient = await connectDaemonClient({
		repoRoot: context.repoRoot,
		preferredLaunchMode: resolveDaemonLaunchModeFromModule(import.meta.url)
	});
	const mission = new Mission(daemonClient);

	try {
		return await callback(mission);
	} finally {
		daemonClient.dispose();
	}
}

export function resolveMissionSelector(flags: ParsedFlagMap): {
	selector: MissionSelector;
	issueId?: number;
	branchRef?: string;
	issueIdFlag?: string;
} {
	const issueValue = flags.get('issue');
	const issueIdFlag = typeof issueValue === 'string' && issueValue.length > 0 ? issueValue : undefined;
	const branchValue = flags.get('branch');
	const branchRef = typeof branchValue === 'string' && branchValue.length > 0 ? branchValue : undefined;
	const issueId = issueIdFlag && /^\d+$/.test(issueIdFlag) ? Number(issueIdFlag) : undefined;

	if (issueIdFlag && issueId === undefined) {
		throw new Error(`Invalid --issue value '${issueIdFlag}'. Expected a numeric issue id.`);
	}

	return {
		selector: {
			...(issueId !== undefined ? { issueId } : {}),
			...(branchRef ? { branchRef } : {})
		},
		...(issueId !== undefined ? { issueId } : {}),
		...(branchRef ? { branchRef } : {}),
		...(issueIdFlag ? { issueIdFlag } : {})
	};
}
