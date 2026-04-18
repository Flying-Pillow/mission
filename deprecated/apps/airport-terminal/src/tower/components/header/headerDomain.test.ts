import { describe, expect, it } from 'vitest';
import {
	airportHomeTabId,
	buildHeaderTabs,
	repositoryTabId,
	resolveHeaderWorkspaceLabel
} from './headerDomain.js';

describe('buildHeaderTabs', () => {
	it('keeps the airport tab first, then the repository tab, ahead of mission tabs', () => {
		const tabs = buildHeaderTabs(
			{
				missionId: '42-add-tab-strip-scrolling',
				control: {
					trackingProvider: 'github',
					githubRepository: 'flying-pillow/mission'
				}
			} as never,
			[
				{
					branchRef: 'refs/heads/42-add-tab-strip-scrolling',
					createdAt: '2026-04-15T00:00:00.000Z',
					missionId: '42-add-tab-strip-scrolling',
					issueId: 42,
					title: 'Add tab strip scrolling'
				},
				{
					branchRef: 'refs/heads/99-fix-header-order',
					createdAt: '2026-04-15T00:00:00.000Z',
					missionId: '99-fix-header-order',
					issueId: 99,
					title: 'Fix header tab order'
				}
			]
		);

		expect(tabs.map((tab) => tab.id)).toEqual([
			airportHomeTabId,
			repositoryTabId,
			'mission:42-add-tab-strip-scrolling',
			'mission:99-fix-header-order'
		]);
	});

	it('preserves mission candidate order when the active mission is not first', () => {
		const tabs = buildHeaderTabs(
			{
				missionId: '99-fix-header-order',
				control: {
					trackingProvider: 'github',
					githubRepository: 'flying-pillow/mission'
				}
			} as never,
			[
				{
					branchRef: 'refs/heads/42-add-tab-strip-scrolling',
					createdAt: '2026-04-15T00:00:00.000Z',
					missionId: '42-add-tab-strip-scrolling',
					issueId: 42,
					title: 'Add tab strip scrolling'
				},
				{
					branchRef: 'refs/heads/99-fix-header-order',
					createdAt: '2026-04-15T00:00:00.000Z',
					missionId: '99-fix-header-order',
					issueId: 99,
					title: 'Fix header tab order'
				}
			]
		);

		expect(tabs.map((tab) => tab.id)).toEqual([
			airportHomeTabId,
			repositoryTabId,
			'mission:42-add-tab-strip-scrolling',
			'mission:99-fix-header-order'
		]);
	});

	it('renders the repository initialization mission tab as INIT', () => {
		const tabs = buildHeaderTabs(
			{
				missionId: 'mission-init-scaffold',
				control: {
					trackingProvider: 'github',
					githubRepository: 'flying-pillow/mission'
				}
			} as never,
			[
				{
					branchRef: 'refs/heads/mission/init-scaffold',
					createdAt: '2026-04-15T00:00:00.000Z',
					missionId: 'mission-init-scaffold',
					title: 'Initialize Mission repository scaffolding'
				}
			]
		);

		expect(tabs.find((tab) => tab.id === 'mission:mission-init-scaffold')?.label).toBe('INIT');
	});
});


describe('resolveHeaderWorkspaceLabel', () => {
	it('returns only the repository slug when githubRepository is owner/repo', () => {
		const label = resolveHeaderWorkspaceLabel(
			{
				trackingProvider: 'github',
				githubRepository: 'flying-pillow/mission'
			} as never,
			'/tmp/workspace'
		);
		expect(label).toBe('mission');
	});

	it('falls back to workspace root when githubRepository is unavailable', () => {
		const label = resolveHeaderWorkspaceLabel(undefined, '/tmp/workspace');
		expect(label).toBe('/tmp/workspace');
	});
});
