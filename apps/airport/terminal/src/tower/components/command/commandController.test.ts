import { describe, expect, it } from 'vitest';
import { buildAvailableActionsQueryKey } from './commandController.js';

describe('buildAvailableActionsQueryKey', () => {
	it('changes when the Tower state revision changes even if mission context stays the same', () => {
		const base = {
			mode: 'mission' as const,
			missionId: 'mission-42',
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
			context: { taskId: 'task-1' }
		})).toBe(buildAvailableActionsQueryKey({
			actionsInvalidationKey: 'revision-1',
			mode: 'repository',
			missionId: undefined,
			context: {}
		}));
	});
});