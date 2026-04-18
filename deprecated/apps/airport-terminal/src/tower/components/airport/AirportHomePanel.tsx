/** @jsxImportSource @opentui/solid */

import { isAirportHomeNonSelectableItemId } from './airportHomeDomain.js';
import { SelectPanel } from '../SelectPanel.js';
import type { SelectItem, TowerKeyEvent } from '../types.js';

type AirportHomePanelProps = {
	items: SelectItem[];
	selectedItemId: string | undefined;
	focused: boolean;
	onActivateSelection: (itemId: string | undefined) => void;
	onItemChange: (itemId: string) => void;
	onFocusCommand?: () => void;
};

export function AirportHomePanel(props: AirportHomePanelProps) {
	return (
		<SelectPanel
			title="AIRPORT HOME"
			items={props.items}
			selectedItemId={props.selectedItemId}
			focused={props.focused}
			emptyLabel="Airport is ready. Add the first repository to begin."
			helperText="Manage the Airport repository registry here. Select a repository to open its control surface, or add a new local checkout."
			countLabel="actions"
			isItemSelectable={(item) => !isAirportHomeNonSelectableItemId(item.id)}
			onKeyDown={(event) => {
				handleAirportHomeKeyDown(event, props);
			}}
			onItemChange={props.onItemChange}
			onItemSelect={(itemId) => {
				void props.onActivateSelection(itemId);
			}}
		/>
	);
}

function handleAirportHomeKeyDown(
	event: TowerKeyEvent,
	props: AirportHomePanelProps
): void {
	if (event.name === 'right') {
		event.preventDefault();
		event.stopPropagation();
		props.onFocusCommand?.();
	}
}