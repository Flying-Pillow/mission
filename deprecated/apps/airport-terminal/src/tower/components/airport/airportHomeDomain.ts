import type { MissionRepositoryCandidate } from '@flying-pillow/mission-core';
import type { SelectItem } from '../types.js';

export const airportHomeAddRepositoryItemId = 'airport:add-repository';

export function buildAirportHomeItems(input: {
	availableRepositories: MissionRepositoryCandidate[];
	selectedRepositoryRoot: string | undefined;
}): SelectItem[] {
	const items: SelectItem[] = [
		{
			id: 'section:repositories',
			label: 'Registered repositories:',
			description: ''
		}
	];

	for (const repository of input.availableRepositories) {
		const isSelected = repository.repositoryRootPath === input.selectedRepositoryRoot;
		items.push({
			id: `repository:${repository.repositoryRootPath}`,
			label: repository.label,
			description: isSelected
				? `${repository.description} · current`
				: repository.description
		});
	}

	items.push({
		id: 'separator:airport-home-actions',
		label: '',
		description: ''
	});
	items.push({
		id: 'section:airport-home-actions',
		label: 'Airport actions:',
		description: ''
	});
	items.push({
		id: airportHomeAddRepositoryItemId,
		label: 'Add repository',
		description: 'Register another local git repository with Airport.'
	});

	return items;
}

export function pickPreferredAirportHomeItemId(
	items: SelectItem[],
	currentItemId: string | undefined
): string | undefined {
	if (currentItemId && items.some((item) => item.id === currentItemId && !isAirportHomeNonSelectableItemId(item.id))) {
		return currentItemId;
	}
	return items.find((item) => !isAirportHomeNonSelectableItemId(item.id))?.id;
}

export function isAirportHomeNonSelectableItemId(itemId: string): boolean {
	return itemId.startsWith('section:') || itemId.startsWith('separator:');
}