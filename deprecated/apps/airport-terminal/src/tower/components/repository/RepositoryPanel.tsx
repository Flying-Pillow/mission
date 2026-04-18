/** @jsxImportSource @opentui/solid */

import { SelectPanel } from '../SelectPanel.js';
import type { SelectItem, TowerKeyEvent } from '../types.js';

type RepositoryPanelProps = {
	items: SelectItem[];
	selectedItemId: string | undefined;
	focused: boolean;
	onActivateSelection: (itemId: string | undefined) => void;
	onItemChange: (itemId: string) => void;
	onFocusCommand?: () => void;
};

export function RepositoryPanel(props: RepositoryPanelProps) {
	return (
		<SelectPanel
			title="REPOSITORY SELECTION"
			items={props.items}
			selectedItemId={props.selectedItemId}
			focused={props.focused}
			emptyLabel="No missions or GitHub issues are available right now."
			helperText="Choose an active mission, pick an open issue that is not already active, or start a new mission."
			isItemSelectable={(item) => !isRepositorySelectionNonSelectableId(item.id)}
			onKeyDown={(event) => {
				handleRepositorySelectionKeyDown(event, props);
			}}
			onItemChange={props.onItemChange}
			onItemSelect={(itemId) => {
				void props.onActivateSelection(itemId);
			}}
		/>
	);
}

function handleRepositorySelectionKeyDown(
	event: TowerKeyEvent,
	props: RepositoryPanelProps
): void {
	if (event.name === 'right') {
		event.preventDefault();
		event.stopPropagation();
		props.onFocusCommand?.();
	}
}

function isRepositorySelectionNonSelectableId(itemId: string): boolean {
	return itemId.startsWith('section:') || itemId.startsWith('separator:');
}
