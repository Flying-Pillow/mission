/** @jsxImportSource @opentui/solid */

import type { SelectOption } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/solid';
import { For, createMemo, Show } from 'solid-js';
import { towerTheme } from './towerTheme.js';
import { Panel } from './Panel.js';
import type { TowerKeyEvent, SelectItem } from './types.js';

type SelectPanelProps = {
	title: string;
	items: SelectItem[];
	selectedItemId: string | undefined;
	focused: boolean;
	emptyLabel: string;
	helperText?: string | string[];
	filterValue?: string;
	style?: Record<string, string | number | undefined>;
	maxVisibleOptions?: number;
	showSelectionSummary?: boolean;
	showFooterBadges?: boolean;
	countLabel?: string;
	isItemSelectable?: (item: SelectItem) => boolean;
	onItemChange: (itemId: string) => void;
	onItemSelect: (itemId: string) => void;
	onKeyDown?: (event: TowerKeyEvent) => void;
};

export function SelectPanel(props: SelectPanelProps) {
	const terminal = useTerminalDimensions();
	const sectionTitleColor = '#93c5fd';
	const availableOptionWidth = createMemo(() => {
		const terminalWidth = terminal().width;
		const normalizedTerminalWidth = Number.isFinite(terminalWidth)
			? Math.floor(terminalWidth)
			: 0;
		return computeOptionWidth(normalizedTerminalWidth, props.style?.['width']);
	});
	const isSelectable = (item: SelectItem): boolean => props.isItemSelectable?.(item) ?? true;
	const selectableItems = createMemo(() => props.items.filter((item) => isSelectable(item)));
	const hasGroupedItems = createMemo(() => props.items.some((item) => !isSelectable(item)));
	const sectionBlocks = createMemo(() => buildSectionBlocks(props.items, isSelectable));
	const columnWidths = createMemo(() => splitOptionColumns(availableOptionWidth()));
	const selectedIndex = createMemo(() =>
		resolveSelectedIndex(props.items, props.selectedItemId)
	);
	const options = createMemo<SelectOption[]>(() =>
		props.items.map((item) => {
			const [leftWidth, rightWidth] = splitOptionColumns(availableOptionWidth());
			return {
				name: formatOptionLine(item, leftWidth, rightWidth),
				description: '',
				value: item.id
			};
		})
	);
	const selectedItem = createMemo(() => {
		if (props.selectedItemId) {
			const exactMatch = props.items.find((item) => item.id === props.selectedItemId);
			if (exactMatch) {
				return exactMatch;
			}
		}
		return selectableItems()[0] ?? props.items[0];
	});
	const activeSelectedItemId = createMemo(() => selectedItem()?.id);
	const helperLines = createMemo(() =>
		Array.isArray(props.helperText)
			? props.helperText.filter((line) => line.trim().length > 0)
			: typeof props.helperText === 'string' && props.helperText.trim().length > 0
				? [props.helperText]
				: []
	);

	return (
		<Panel
			title={props.title}
			borderColor={props.focused ? towerTheme.accent : towerTheme.border}
			style={{ flexGrow: 1, ...(props.style ?? {}) }}
			contentStyle={{ flexGrow: 1, gap: 1 }}
			{...(props.showFooterBadges === false
				? {}
				: {
					footerBadges: [
						{ text: `${String(selectableItems().length)} ${props.countLabel ?? 'options'}` },
						{ text: props.focused ? 'focused' : 'background', tone: props.focused ? 'accent' : 'neutral' }
					]
				})}
		>
			<Show
				when={props.items.length > 0}
				fallback={
					<box style={{ flexDirection: 'column' }}>
						<text style={{ fg: towerTheme.secondaryText }}>{props.emptyLabel}</text>
					</box>
				}
			>
				<Show when={props.filterValue?.trim().length}>
					<text style={{ fg: towerTheme.brightText }}>{`Filter: ${props.filterValue}`}</text>
				</Show>
				<For each={helperLines()}>
					{(line) => <text style={{ fg: towerTheme.secondaryText }}>{line}</text>}
				</For>
				<Show when={props.showSelectionSummary !== false}>
					<text style={{ fg: towerTheme.brightText }}>{selectedItem()?.label ?? 'No option selected'}</text>
					<text style={{ fg: towerTheme.secondaryText }}>{selectedItem()?.description ?? props.emptyLabel}</text>
				</Show>

				<box
					style={{
						...(props.showSelectionSummary === false ? {} : { marginTop: 1 }),
						flexGrow: 1
					}}
				>
					<Show
						when={!hasGroupedItems()}
						fallback={
							<scrollbox style={{ flexGrow: 1, flexShrink: 1, minHeight: 0 }}>
								<box style={{ flexDirection: 'column', gap: 1, minHeight: 0 }}>
									<For each={sectionBlocks()}>
										{(block) => (
											<box style={{ flexDirection: 'column', ...(block.separatedBefore ? { marginTop: 1 } : {}) }}>
												<Show when={block.title}>
													<text style={{ fg: sectionTitleColor }}>{block.title}</text>
												</Show>
												<Show
													when={block.rows.some((item) => item.id === activeSelectedItemId())}
													fallback={
														<box style={{ flexDirection: 'column' }}>
															<For each={block.rows}>
																{(item) => (
																	<box style={{ flexDirection: 'row', backgroundColor: towerTheme.panelBackground }}>
																		<text style={{ fg: resolveStaticRowColor(item) }}>
																			{formatOptionLine(item, columnWidths()[0], columnWidths()[1])}
																		</text>
																	</box>
																)}
															</For>
														</box>
													}
												>
													<select
														focused={props.focused}
														height={Math.max(1, block.rows.length)}
														width="100%"
														options={block.rows.map((item) => ({
															name: formatOptionLine(item, columnWidths()[0], columnWidths()[1]),
															description: '',
															value: item.id
														}))}
														selectedIndex={resolveSelectedIndex(block.rows, activeSelectedItemId())}
														backgroundColor={towerTheme.panelBackground}
														textColor={towerTheme.bodyText}
														focusedBackgroundColor={towerTheme.panelBackground}
														focusedTextColor={towerTheme.primaryText}
														selectedBackgroundColor={towerTheme.accentSoft}
														selectedTextColor={towerTheme.brightText}
														descriptionColor={towerTheme.secondaryText}
														selectedDescriptionColor={towerTheme.primaryText}
														showDescription={false}
														onKeyDown={(event) => {
															if ((event.name === 'up' || event.name === 'down') && selectableItems().length > 0) {
																event.preventDefault();
																event.stopPropagation();
																moveSelection(props.items, activeSelectedItemId(), event.name === 'up' ? -1 : 1, isSelectable, props.onItemChange);
																props.onKeyDown?.(event);
																return;
															}
															props.onKeyDown?.(event);
														}}
														onChange={(_index, option) => {
															const itemId = String(option?.value ?? '');
															if (block.rows.some((item) => item.id === itemId)) {
																props.onItemChange(itemId);
															}
														}}
														onSelect={(_index, option) => {
															const itemId = String(option?.value ?? '');
															if (block.rows.some((item) => item.id === itemId)) {
																props.onItemSelect(itemId);
															}
														}}
													/>
												</Show>
											</box>
										)}
									</For>
								</box>
							</scrollbox>
						}
					>
						<select
							focused={props.focused}
							height="100%"
							width="100%"
							options={options()}
							selectedIndex={selectedIndex()}
							backgroundColor={towerTheme.panelBackground}
							textColor={towerTheme.bodyText}
							focusedBackgroundColor={towerTheme.panelBackground}
							focusedTextColor={towerTheme.primaryText}
							selectedBackgroundColor={towerTheme.accentSoft}
							selectedTextColor={towerTheme.brightText}
							descriptionColor={towerTheme.secondaryText}
							selectedDescriptionColor={towerTheme.primaryText}
							showDescription={false}
							onKeyDown={(event) => {
								if ((event.name === 'up' || event.name === 'down') && selectableItems().length > 0) {
									event.preventDefault();
									event.stopPropagation();
									moveSelection(props.items, props.selectedItemId, event.name === 'up' ? -1 : 1, isSelectable, props.onItemChange);
									props.onKeyDown?.(event);
									return;
								}
								props.onKeyDown?.(event);
							}}
							onChange={(_index, option) => {
								const itemId = String(option?.value ?? '');
								const item = props.items.find((candidate) => candidate.id === itemId);
								if (!item || !isSelectable(item)) {
									return;
								}
								props.onItemChange(itemId);
							}}
							onSelect={(_index, option) => {
								const itemId = String(option?.value ?? '');
								const item = props.items.find((candidate) => candidate.id === itemId);
								if (!item || !isSelectable(item)) {
									return;
								}
								props.onItemSelect(itemId);
							}}
						/>
					</Show>
				</box>
			</Show>
		</Panel>
	);
}

function resolveSelectedIndex(items: SelectItem[], selectedItemId: string | undefined): number {
	if (items.length === 0) {
		return 0;
	}
	if (!selectedItemId) {
		return 0;
	}
	const index = items.findIndex((item) => item.id === selectedItemId);
	return index >= 0 ? index : 0;
}

function moveSelection(
	items: SelectItem[],
	selectedItemId: string | undefined,
	delta: number,
	isSelectable: (item: SelectItem) => boolean,
	onItemChange: (itemId: string) => void
): void {
	const selectableItems = items.filter((item) => isSelectable(item));
	if (selectableItems.length === 0) {
		return;
	}
	const currentIndex = Math.max(0, selectableItems.findIndex((item) => item.id === selectedItemId));
	const nextIndex = (currentIndex + delta + selectableItems.length) % selectableItems.length;
	const nextItemId = selectableItems[nextIndex]?.id;
	if (nextItemId) {
		onItemChange(nextItemId);
	}
}

function buildSectionBlocks(
	items: SelectItem[],
	isSelectable: (item: SelectItem) => boolean
): Array<{ title: string | undefined; rows: SelectItem[]; separatedBefore: boolean }> {
	const blocks: Array<{ title: string | undefined; rows: SelectItem[]; separatedBefore: boolean }> = [];
	let currentTitle: string | undefined;
	let currentRows: SelectItem[] = [];
	let separatedBefore = false;

	const pushCurrent = () => {
		if (currentTitle || currentRows.length > 0) {
			blocks.push({ title: currentTitle, rows: currentRows, separatedBefore });
		}
	};

	for (const item of items) {
		if (!isSelectable(item) && item.id.startsWith('separator:')) {
			pushCurrent();
			currentTitle = undefined;
			currentRows = [];
			separatedBefore = true;
			continue;
		}
		if (!isSelectable(item) && item.id.startsWith('section:')) {
			pushCurrent();
			currentTitle = item.label;
			currentRows = [];
			continue;
		}
		currentRows = [...currentRows, item];
	}

	pushCurrent();
	return blocks;
}

function computeOptionWidth(terminalWidth: number, styleWidth: string | number | undefined): number {
	const fallbackWidth = Math.max(24, terminalWidth - 10);
	if (typeof styleWidth === 'number' && Number.isFinite(styleWidth)) {
		return Math.max(24, Math.floor(styleWidth) - 6);
	}
	if (typeof styleWidth === 'string' && styleWidth.endsWith('%')) {
		const percent = Number.parseFloat(styleWidth.slice(0, -1));
		if (Number.isFinite(percent)) {
			return Math.max(24, Math.floor((terminalWidth * percent) / 100) - 6);
		}
	}
	return fallbackWidth;
}

function splitOptionColumns(totalWidth: number): [number, number] {
	const gutterWidth = 3;
	const innerWidth = Math.max(10, totalWidth - gutterWidth);
	const leftWidth = Math.max(10, Math.floor(innerWidth * 0.42));
	const rightWidth = Math.max(8, innerWidth - leftWidth);
	return [leftWidth, rightWidth];
}


function formatOptionLine(item: SelectItem, leftWidth: number, rightWidth: number): string {
	if (item.id.startsWith('section:')) {
		return item.label;
	}
	if (item.id.startsWith('separator:')) {
		return '-'.repeat(Math.max(leftWidth + rightWidth + 3, 1));
	}
	const label = item.label;
	const description = item.description;
	const leftCell = fitCell(label, leftWidth, true);
	const rightCell = fitCell(description, rightWidth, false);
	return `${leftCell} | ${rightCell}`;
}

function resolveStaticRowColor(item: SelectItem): string {
	return item.description.includes('· current') ? '#add8e6' : towerTheme.bodyText;
}

function fitCell(value: string, width: number, padEndValue: boolean): string {
	const trimmed = value.trim();
	if (width <= 0) {
		return '';
	}
	if (trimmed.length <= width) {
		return padEndValue ? trimmed.padEnd(width, ' ') : trimmed;
	}
	if (width <= 3) {
		return trimmed.slice(0, width);
	}
	return `${trimmed.slice(0, width - 3)}...`;
}