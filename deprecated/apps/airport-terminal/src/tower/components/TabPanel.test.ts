import { describe, expect, it } from 'vitest';
import { buildPagedTabWindow } from './TabPanelDomain.js';
import type { TabPanelTab } from './TabPanel.js';

const tabs: TabPanelTab[] = [
	{ id: 'mission:1', label: 'MISSION 1' },
	{ id: 'mission:2', label: 'MISSION 2' },
	{ id: 'mission:3', label: 'MISSION 3' },
	{ id: 'mission:4', label: 'MISSION 4' }
];

describe('buildPagedTabWindow', () => {
	it('keeps the current page stable until selection moves beyond the right edge', () => {
			const viewport = buildPagedTabWindow(tabs, 0, 33);

		expect(viewport).toEqual({
			startIndex: 0,
			endIndex: 1,
			showPreviousControl: false,
			showNextControl: true
		});
	});

	it('shifts by one tab when paging right to the next mission tab', () => {
			const viewport = buildPagedTabWindow(tabs, 1, 38);

		expect(viewport).toEqual({
			startIndex: 1,
			endIndex: 2,
			showPreviousControl: true,
			showNextControl: true
		});
	});

	it('never collapses to controls without at least one visible tab', () => {
		const viewport = buildPagedTabWindow(tabs, 3, 10);

		expect(viewport).toEqual({
			startIndex: 3,
			endIndex: 3,
			showPreviousControl: true,
			showNextControl: false
		});
	});
});