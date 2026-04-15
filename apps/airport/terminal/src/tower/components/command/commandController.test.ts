import { describe, expect, it } from 'vitest';
import { buildAvailableActionsQueryKey } from './commandController.js';
import { describeCommandFlowCompletionMessage } from './commandDomain.js';

describe('buildAvailableActionsQueryKey', () => {
	it('changes when the Tower state revision changes even if mission context stays the same', () => {
		const base = {
			mode: 'mission' as const,
			missionId: 'mission-42',
			commandSelectionKey: 'tree:task:task-1',
			context: { taskId: 'task-1' }
		};

		const before = buildAvailableActionsQueryKey({
			...base,
			actionsInvalidationKey: 'revision-1'
		});
		const after = buildAvailableActionsQueryKey({
			...base,
			actionsInvalidationKey: 'revision-2'
		});

		expect(before).not.toBe(after);
	});

	it('ignores mission context when the Tower is in repository mode', () => {
		expect(buildAvailableActionsQueryKey({
			actionsInvalidationKey: 'revision-1',
			mode: 'repository',
			missionId: 'mission-42',
			commandSelectionKey: 'tree:task:task-1',
			context: { taskId: 'task-1' }
		})).toBe(buildAvailableActionsQueryKey({
			actionsInvalidationKey: 'revision-1',
			mode: 'repository',
			missionId: undefined,
			commandSelectionKey: 'tree:task:task-2',
			context: {}
		}));
	});

	it('changes when mission tree selection changes even if context shape is unchanged', () => {
		const before = buildAvailableActionsQueryKey({
			actionsInvalidationKey: 'revision-1',
			mode: 'mission',
			missionId: 'mission-42',
			commandSelectionKey: 'tree:task:task-1',
			context: { stageId: 'implementation' }
		});
		const after = buildAvailableActionsQueryKey({
			actionsInvalidationKey: 'revision-1',
			mode: 'mission',
			missionId: 'mission-42',
			commandSelectionKey: 'tree:task:task-2',
			context: { stageId: 'implementation' }
		});

		expect(before).not.toBe(after);
	});

	it('describes /init completion as a prepared mission worktree', () => {
		expect(describeCommandFlowCompletionMessage({
			id: 'control.repository.init',
			label: 'Prepare the first repository initialization mission',
			action: '/init',
			scope: 'mission',
			disabled: false,
			disabledReason: '',
			enabled: true
		}, {
			found: false,
			preparation: {
				kind: 'mission',
				state: 'branch-prepared',
				missionId: 'mission-1',
				branchRef: 'mission/1-init-repository',
				baseBranch: 'main',
				worktreePath: '/tmp/mission-1',
				missionRootDir: '/tmp/mission-1/.mission/missions/mission-1'
			}
		} as any)).toBe('Mission mission-1 prepared on mission/1-init-repository. Worktree: /tmp/mission-1');
	});
});