import { describe, expect, it } from 'vitest';
import {
	buildActionsInvalidationKey,
	buildMissionActionsRevision,
	computeSelectionBindingSyncPlan,
	} from './airportAppDomain.js';
import { resolvePanelBindingsFromSelection } from './tower/components/mission-control/panelBindings.js';

describe('resolvePanelBindingsFromSelection', () => {
	it('binds mission-level briefing room target and keeps runway empty', () => {
		expect(resolvePanelBindingsFromSelection(undefined, 'mission-13')).toEqual({
			briefingRoom: {
				targetKind: 'mission',
				targetId: 'mission-13',
				mode: 'view'
			},
			runway: {
				targetKind: 'empty'
			}
		});
	});

	it('binds the resolved task instruction artifact into Briefing Room', () => {
		expect(resolvePanelBindingsFromSelection({
			missionId: 'mission-13',
			taskId: 'task-1',
			activeInstructionArtifactId: 'mission-13:task:task-1',
			activeInstructionPath: '/tmp/mission-13/01-PRD/tasks/01-prd-from-brief.md'
		}, 'mission-13')).toEqual({
			briefingRoom: {
				targetKind: 'artifact',
				targetId: 'mission-13:task:task-1',
				mode: 'view'
			},
			runway: {
				targetKind: 'empty'
			}
		});
	});

	it('binds the resolved stage result artifact into Briefing Room', () => {
		expect(resolvePanelBindingsFromSelection({
			missionId: 'mission-13',
			stageId: 'spec',
			activeStageResultArtifactId: 'mission-13:spec',
			activeStageResultPath: '/tmp/mission-13/02-SPEC/SPEC.md'
		}, 'mission-13')).toEqual({
			briefingRoom: {
				targetKind: 'artifact',
				targetId: 'mission-13:spec',
				mode: 'view'
			},
			runway: {
				targetKind: 'empty'
			}
		});
	});

	it('binds runway to the selected active agent session', () => {
		expect(resolvePanelBindingsFromSelection({
			missionId: 'mission-13',
			activeAgentSessionId: 'session-7'
		}, 'mission-13')).toEqual({
			briefingRoom: {
				targetKind: 'mission',
				targetId: 'mission-13',
				mode: 'view'
			},
			runway: {
				targetKind: 'agentSession',
				targetId: 'session-7',
				mode: 'view'
			}
		});
	});

	it('does not bind briefing room for a selection without a resolved artifact or mission target', () => {
		expect(resolvePanelBindingsFromSelection({
			activeAgentSessionId: 'session-7'
		}, undefined)).toBeUndefined();
	});

	it('does not change mission action invalidation when only airport system version changes outside mission status', () => {
		const before = buildActionsInvalidationKey({
			mode: 'mission',
			status: {
				found: true,
				missionId: 'mission-13',
				workflow: {
					lifecycle: 'running',
					updatedAt: '2026-01-01T00:00:00.000Z'
				}
			} as any,
			missionActionsRevision: undefined
		});
		const after = buildActionsInvalidationKey({
			mode: 'mission',
			status: {
				found: true,
				missionId: 'mission-13',
				workflow: {
					lifecycle: 'running',
					updatedAt: '2026-01-01T00:00:00.000Z'
				},
				system: {
					state: {
						version: 999
					}
				}
			} as any,
			missionActionsRevision: undefined
		});

		expect(before).toBe(after);
	});

	it('builds mission action revision from workflow update time before falling back to system version', () => {
		expect(buildMissionActionsRevision({
			found: true,
			missionId: 'mission-13',
			workflow: {
				lifecycle: 'paused',
				updatedAt: '2026-01-01T00:00:00.000Z'
			},
			system: {
				state: {
					version: 42
				}
			}
		} as any)).toBe('mission:mission-13:2026-01-01T00:00:00.000Z');
	});

	it('does not requeue identical pane bindings while the same selection sync is already in flight', () => {
		const desiredBindings = {
			briefingRoom: {
				targetKind: 'artifact' as const,
				targetId: 'mission-13:prd',
				mode: 'view' as const
			},
			runway: {
				targetKind: 'empty' as const
			}
		};
		const desiredSyncKey = JSON.stringify(desiredBindings);

		expect(computeSelectionBindingSyncPlan({
			desiredBindings,
			currentPanes: {
				tower: {
					targetKind: 'repository',
					mode: 'control'
				},
				briefingRoom: {
					targetKind: 'mission',
					targetId: 'mission-13',
					mode: 'view'
				},
				runway: {
					targetKind: 'empty'
				}
			},
			acknowledgedSyncKey: undefined,
			inFlightSyncKey: desiredSyncKey
		})).toMatchObject({
			desiredSyncKey,
			currentMatches: false,
			shouldQueue: false
		});
	});

	it('marks pane binding sync as satisfied once airport panes match the desired selection', () => {
		const desiredBindings = {
			briefingRoom: {
				targetKind: 'artifact' as const,
				targetId: 'mission-13:prd',
				mode: 'view' as const
			},
			runway: {
				targetKind: 'empty' as const
			}
		};

		expect(computeSelectionBindingSyncPlan({
			desiredBindings,
			currentPanes: {
				tower: {
					targetKind: 'repository',
					mode: 'control'
				},
				briefingRoom: desiredBindings.briefingRoom!,
				runway: desiredBindings.runway!
			},
			acknowledgedSyncKey: undefined,
			inFlightSyncKey: undefined
		})).toMatchObject({
			currentMatches: true,
			shouldQueue: false,
			updates: []
		});
	});
});