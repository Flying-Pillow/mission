/** @jsxImportSource @opentui/solid */

import { For, Show, createEffect, createMemo, createSignal, type JSXElement } from 'solid-js';
import { useTerminalDimensions } from '@opentui/solid';
import type { PanelBadge, PanelBadgeTone } from './Panel.js';
import { TAB_GAP, TAB_SCROLL_CONTROL_WIDTH, buildPagedTabWindow, estimateTabWidth } from './TabPanelDomain.js';
import { towerTheme } from './towerTheme.js';

type PanelStyle = Record<string, string | number | undefined>;

const TAB_ROW_LEADING_PADDING = 2;
const TAB_SCROLL_PREVIOUS_GLYPH = '‹';
const TAB_SCROLL_NEXT_GLYPH = '›';

export type TabPanelTab = {
	id: string;
	label: string;
	labelColor?: string;
};

export type TabPanelLine = {
	text?: string;
	fg?: string;
	segments?: Array<{
		text: string;
		fg: string;
	}>;
};

export type TabPanelProps = {
	focused: boolean;
	tabs: TabPanelTab[];
	selectedTabId: string | undefined;
	pinnedFirstTab?: boolean;
	tabsFocusable?: boolean;
	title?: string;
	titleColor?: string;
	borderColor?: string;
	backgroundColor?: string;
	footerBadges?: PanelBadge[];
	style?: PanelStyle;
	contentStyle?: PanelStyle;
	bodyLines?: TabPanelLine[];
	bodyRows?: number;
	children?: JSXElement;
};

export function TabPanel(props: TabPanelProps) {
	void props.title;
	void props.titleColor;

	const terminal = useTerminalDimensions();
	const panelWidth = createMemo(() => {
		const terminalWidth = terminal().width;
		const normalizedTerminalWidth = Number.isFinite(terminalWidth)
			? Math.floor(terminalWidth)
			: 0;
		return Math.max(normalizedTerminalWidth - 2, 20);
	});
	const interiorWidth = createMemo(() => {
		const width = panelWidth();
		const normalizedWidth = Number.isFinite(width) ? Math.floor(width) : 20;
		return Math.max(normalizedWidth - 2, 18);
	});
	const rows = createMemo(() => Math.max(1, props.bodyRows ?? 1));
	const borderColor = createMemo(() =>
		props.borderColor ?? (props.focused ? towerTheme.accent : towerTheme.border)
	);
	const panelBackground = createMemo(() => props.backgroundColor ?? towerTheme.panelBackground);
	const pinnedTabs = createMemo(() => (props.pinnedFirstTab === true ? props.tabs.slice(0, 1) : []));
	const scrollableTabs = createMemo(() => (props.pinnedFirstTab === true ? props.tabs.slice(1) : props.tabs));
	const [scrollStartIndex, setScrollStartIndex] = createSignal(0);
	const pinnedWidth = createMemo(() => {
		const pinnedTab = pinnedTabs()[0];
		return pinnedTab ? estimateTabWidth(pinnedTab.label) : 0;
	});
	const availableScrollableWidth = createMemo(() => {
		const hasPinnedTab = pinnedTabs().length > 0;
		const hasScrollableTabs = scrollableTabs().length > 0;
		const reservedWidth = hasPinnedTab
			? pinnedWidth() + (hasScrollableTabs ? TAB_GAP : 0)
			: 0;
		return Math.max(panelWidth() - TAB_ROW_LEADING_PADDING - reservedWidth, 0);
	});

	const scrollViewport = createMemo(() =>
		buildPagedTabWindow(scrollableTabs(), scrollStartIndex(), availableScrollableWidth())
	);

	createEffect(() => {
		const tabs = scrollableTabs();
		const currentStartIndex = scrollStartIndex();
		const viewport = scrollViewport();
		const selectedId = props.selectedTabId;
		const selectedIndex = tabs.findIndex((tab) => tab.id === selectedId);
		const maxStartIndex = Math.max(0, tabs.length - 1);

		if (currentStartIndex > maxStartIndex) {
			setScrollStartIndex(maxStartIndex);
			return;
		}
		if (viewport.startIndex !== currentStartIndex) {
			setScrollStartIndex(viewport.startIndex);
			return;
		}
		if (selectedIndex < 0) {
			return;
		}
		if (selectedIndex < viewport.startIndex) {
			setScrollStartIndex(selectedIndex);
			return;
		}
		if (selectedIndex > viewport.endIndex) {
			setScrollStartIndex(Math.min(currentStartIndex + (selectedIndex - viewport.endIndex), maxStartIndex));
		}
	});

	const renderedStrip = createMemo(() => {
		const viewport = scrollViewport();
		const segments: Array<{ text: string; fg: string }> = [];
		const layouts: Array<{ tab: TabPanelTab; x: number; width: number; renderedLabel: string }> = [];
		const rowWidth = panelWidth();
		let rowCursor = 0;

		const pushSegment = (text: string, fg: string) => {
			if (text.length === 0) {
				return;
			}
			segments.push({ text, fg });
			rowCursor += text.length;
		};

		pushSegment(' '.repeat(Math.min(TAB_ROW_LEADING_PADDING, rowWidth)), borderColor());

		const pinnedTab = pinnedTabs()[0];
		if (pinnedTab) {
			const remainingWidth = Math.max(rowWidth - rowCursor, 0);
			const renderedLabel = fitTabLabel(pinnedTab.label, Math.max(1, remainingWidth - 4));
			const tabWidth = renderedLabel.length + 4;
			layouts.push({
				tab: pinnedTab,
				x: Math.max(rowCursor - 1, 0),
				width: tabWidth,
				renderedLabel
			});

			if (pinnedTab.id === props.selectedTabId) {
				pushSegment('│ ', borderColor());
				pushSegment(renderedLabel, towerTheme.brightText);
				pushSegment(' │', borderColor());
			} else {
				pushSegment(`  ${renderedLabel}  `, pinnedTab.labelColor ?? towerTheme.mutedText);
			}
		}

		const items: Array<
			| { kind: 'control'; glyph: string }
			| { kind: 'tab'; tab: TabPanelTab }
		> = [];
		if (pinnedTab && items.length === 0 && (viewport.startIndex <= viewport.endIndex || viewport.showNextControl)) {
			const gapWidth = Math.min(TAB_GAP, Math.max(rowWidth - rowCursor, 0));
			pushSegment(' '.repeat(gapWidth), borderColor());
		}
		if (viewport.showPreviousControl) {
			items.push({ kind: 'control', glyph: TAB_SCROLL_PREVIOUS_GLYPH });
		}
		for (let index = viewport.startIndex; index <= viewport.endIndex; index += 1) {
			const tab = scrollableTabs()[index];
			if (!tab) {
				continue;
			}
			items.push({ kind: 'tab', tab });
		}
		if (viewport.showNextControl) {
			items.push({ kind: 'control', glyph: TAB_SCROLL_NEXT_GLYPH });
		}

		items.forEach((item, index) => {
			if (index > 0) {
				const gapWidth = Math.min(TAB_GAP, Math.max(rowWidth - rowCursor, 0));
				pushSegment(' '.repeat(gapWidth), borderColor());
			}

			const remainingWidth = Math.max(rowWidth - rowCursor, 0);
			if (remainingWidth <= 0) {
				return;
			}

			if (item.kind === 'control') {
				const controlWidth = Math.min(TAB_SCROLL_CONTROL_WIDTH, remainingWidth);
				pushSegment(
					fitFixedWidthText(` ${item.glyph} `, controlWidth),
					props.focused ? towerTheme.accent : towerTheme.labelText
				);
				return;
			}

			const renderedLabel = fitTabLabel(item.tab.label, Math.max(1, remainingWidth - 4));
			const tabWidth = renderedLabel.length + 4;
			layouts.push({
				tab: item.tab,
				x: Math.max(rowCursor - 1, 0),
				width: tabWidth,
				renderedLabel
			});

			if (item.tab.id === props.selectedTabId) {
				pushSegment('│ ', borderColor());
				pushSegment(renderedLabel, towerTheme.brightText);
				pushSegment(' │', borderColor());
				return;
			}

			pushSegment(`  ${renderedLabel}  `, item.tab.labelColor ?? towerTheme.mutedText);
		});

		if (rowCursor < rowWidth) {
			pushSegment(' '.repeat(rowWidth - rowCursor), borderColor());
		}

		return { segments, layouts };
	});

	const selectedLayout = createMemo(() => {
		const selectedId = props.selectedTabId;
		const layouts = renderedStrip().layouts;
		return layouts.find((layout) => layout.tab.id === selectedId) ?? layouts[0];
	});

	const topTabLine = createMemo(() => {
		const selected = selectedLayout();
		if (!selected) {
			return ''.padEnd(panelWidth(), ' ');
		}
		const line = `${' '.repeat(selected.x + 1)}╭${'─'.repeat(Math.max(selected.width - 2, 1))}╮`;
		return line.padEnd(panelWidth(), ' ');
	});

	const topBorderLine = createMemo(() => {
		const selected = selectedLayout();
		if (!selected) {
			return `╭${'─'.repeat(interiorWidth())}╮`;
		}
		const left = '─'.repeat(Math.max(selected.x, 0));
		const gap = ' '.repeat(Math.max(selected.width - 2, 0));
		const rightWidth = Math.max(interiorWidth() - selected.x - selected.width, 0);
		return `╭${left}╯${gap}╰${'─'.repeat(rightWidth)}╮`;
	});

	const bottomBorderLine = createMemo(() => `╰${'─'.repeat(interiorWidth())}╯`);

	const tabLabelSegments = createMemo(() => {
		return renderedStrip().segments;
	});

	const visibleBodyLines = createMemo(() => {
		const lines = (props.bodyLines ?? []).slice(0, rows());
		while (lines.length < rows()) {
			lines.push({ text: '', fg: towerTheme.bodyText });
		}
		return lines;
	});

	const footerSegments = createMemo(() => renderFooterSegments(props.footerBadges ?? []));

	return (
		<box style={{ flexDirection: 'column', ...(props.style ?? {}) }}>
			<text style={{ fg: borderColor() }}>{topTabLine()}</text>
			<box style={{ flexDirection: 'row', backgroundColor: panelBackground() }}>
				<For each={tabLabelSegments()}>
					{(segment) => <text style={{ fg: segment.fg }}>{segment.text}</text>}
				</For>
			</box>
			<text style={{ fg: borderColor() }}>{topBorderLine()}</text>

			<Show
				when={props.children !== undefined}
				fallback={
					<For each={visibleBodyLines()}>
						{(line) => (
							<box style={{ flexDirection: 'row', backgroundColor: panelBackground() }}>
								<text style={{ fg: borderColor() }}>│</text>
								<Show
									when={line.segments !== undefined && line.segments.length > 0}
									fallback={<text style={{ fg: line.fg ?? towerTheme.bodyText }}>{fitPanelText(line.text ?? '', interiorWidth())}</text>}
								>
									<For each={fitPanelSegments(line.segments ?? [], interiorWidth(), line.fg ?? towerTheme.bodyText)}>
										{(segment) => <text style={{ fg: segment.fg }}>{segment.text}</text>}
									</For>
								</Show>
								<text style={{ fg: borderColor() }}>│</text>
							</box>
						)}
					</For>
				}
			>
				<box
					style={{
						flexDirection: 'row',
						width: panelWidth(),
						backgroundColor: panelBackground(),
						...(props.contentStyle ?? {})
					}}
				>
					<text style={{ fg: borderColor() }}>│</text>
					<box
						style={{
							flexDirection: 'column',
							width: interiorWidth(),
							minWidth: interiorWidth(),
							maxWidth: interiorWidth(),
							flexGrow: 1,
							flexShrink: 1
						}}
					>
						{props.children}
					</box>
					<text style={{ fg: borderColor() }}>│</text>
				</box>
			</Show>

			<Show when={footerSegments().length > 0}>
				<box
					style={{
						flexDirection: 'row',
						justifyContent: 'flex-end',
						paddingRight: 2,
						marginBottom: -1
					}}
				>
					<For each={footerSegments()}>
						{(segment) => <text style={{ fg: footerToneColor(segment.tone) }}>{segment.text}</text>}
					</For>
				</box>
			</Show>

			<text style={{ fg: borderColor() }}>{bottomBorderLine()}</text>
		</box>
	);
}

function fitTabLabel(label: string, maxWidth: number): string {
	const safeWidth = Math.max(1, maxWidth);
	if (label.length <= safeWidth) {
		return label;
	}
	if (safeWidth <= 3) {
		return label.slice(0, safeWidth);
	}
	return `${label.slice(0, safeWidth - 3)}...`;
}

function fitFixedWidthText(text: string, width: number): string {
	if (width <= 0) {
		return '';
	}
	return text.slice(0, width).padEnd(width, ' ');
}


function fitPanelText(text: string, width: number): string {
	if (width <= 0) {
		return '';
	}
	if (width === 1) {
		return ' ';
	}
	const innerWidth = width - 1;
	return ` ${text.slice(0, innerWidth).padEnd(innerWidth, ' ')}`;
}

function fitPanelSegments(
	segments: Array<{ text: string; fg: string }>,
	width: number,
	fallbackFg: string
): Array<{ text: string; fg: string }> {
	if (width <= 0) {
		return [];
	}

	const fitted: Array<{ text: string; fg: string }> = [];
	let remainingWidth = width;

	for (const segment of segments) {
		if (remainingWidth <= 0) {
			break;
		}
		const clipped = segment.text.slice(0, remainingWidth);
		if (clipped.length === 0) {
			continue;
		}
		fitted.push({ text: clipped, fg: segment.fg });
		remainingWidth -= clipped.length;
	}

	if (remainingWidth > 0) {
		fitted.push({ text: ' '.repeat(remainingWidth), fg: fallbackFg });
	}

	return fitted;
}

function renderFooterSegments(
	badges: PanelBadge[]
): Array<{ text: string; tone?: PanelBadgeTone }> {
	const segments: Array<{ text: string; tone?: PanelBadgeTone }> = [];
	for (let index = 0; index < badges.length; index += 1) {
		const badge = badges[index];
		if (!badge) {
			continue;
		}
		if (index > 0) {
			segments.push({ text: '  ' });
		}
		const badgeText = badge.framed === false ? badge.text : `[${badge.text}]`;
		segments.push(
			badge.tone ? { text: badgeText, tone: badge.tone } : { text: badgeText }
		);
	}
	return segments;
}

function footerToneColor(tone: PanelBadgeTone | undefined): string {
	if (tone === 'accent') {
		return towerTheme.accent;
	}
	if (tone === 'success') {
		return towerTheme.success;
	}
	if (tone === 'warning') {
		return towerTheme.warning;
	}
	if (tone === 'danger') {
		return towerTheme.danger;
	}
	return towerTheme.labelText;
}
