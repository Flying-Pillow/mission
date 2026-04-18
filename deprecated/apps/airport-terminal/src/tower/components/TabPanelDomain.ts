export type TabWidthItem = {
	label: string;
};

export type TabViewport = {
	startIndex: number;
	endIndex: number;
	showPreviousControl: boolean;
	showNextControl: boolean;
};

export const TAB_GAP = 2;
export const TAB_SCROLL_CONTROL_WIDTH = 3;
export const TAB_WIDTH_ESTIMATE_LABEL_LIMIT = 12;

export function buildPagedTabWindow(
	tabs: TabWidthItem[],
	startIndex: number,
	availableWidth: number
): TabViewport {
	if (tabs.length === 0) {
		return {
			startIndex: 0,
			endIndex: -1,
			showPreviousControl: false,
			showNextControl: false
		};
	}

	const resolvedStartIndex = Math.max(0, Math.min(startIndex, tabs.length - 1));
	let endIndex = resolvedStartIndex;

	while (endIndex + 1 < tabs.length) {
		if (estimateTabWindowWidth(tabs, resolvedStartIndex, endIndex + 1) > availableWidth) {
			break;
		}
		endIndex += 1;
	}

	return {
		startIndex: resolvedStartIndex,
		endIndex,
		showPreviousControl: resolvedStartIndex > 0,
		showNextControl: endIndex < tabs.length - 1
	};
}

export function estimateTabWidth(label: string): number {
	return Math.min(Math.max(1, label.length), TAB_WIDTH_ESTIMATE_LABEL_LIMIT) + 4;
}

function estimateTabWindowWidth(
	tabs: TabWidthItem[],
	startIndex: number,
	endIndex: number
): number {
	const widths: number[] = [];
	if (startIndex > 0) {
		widths.push(TAB_SCROLL_CONTROL_WIDTH);
	}
	for (let index = startIndex; index <= endIndex; index += 1) {
		const tab = tabs[index];
		if (!tab) {
			continue;
		}
		widths.push(estimateTabWidth(tab.label));
	}
	if (endIndex < tabs.length - 1) {
		widths.push(TAB_SCROLL_CONTROL_WIDTH);
	}
	return widths.reduce((total, width, index) => total + width + (index > 0 ? TAB_GAP : 0), 0);
}