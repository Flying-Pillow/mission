import { describe, expect, it } from 'vitest';
import {
	airportHomeAddRepositoryItemId,
	buildAirportHomeItems,
	pickPreferredAirportHomeItemId,
} from './airportHomeDomain.js';

describe('buildAirportHomeItems', () => {
	it('lists registered repositories ahead of the add-repository action', () => {
		const items = buildAirportHomeItems({
			availableRepositories: [
				{
					repositoryRootPath: '/tmp/mission',
					label: 'mission',
					description: 'flying-pillow/mission'
				}
			],
			selectedRepositoryRoot: '/tmp/mission'
		});

		expect(items.map((item) => item.id)).toEqual([
			'section:repositories',
			'repository:/tmp/mission',
			'separator:airport-home-actions',
			'section:airport-home-actions',
			airportHomeAddRepositoryItemId
		]);
		expect(items.find((item) => item.id === 'repository:/tmp/mission')?.description).toContain('current');
	});

	it('picks the first selectable item when the current one is unavailable', () => {
		const items = buildAirportHomeItems({
			availableRepositories: [],
			selectedRepositoryRoot: undefined
		});

		expect(pickPreferredAirportHomeItemId(items, 'missing')).toBe(airportHomeAddRepositoryItemId);
	});
});