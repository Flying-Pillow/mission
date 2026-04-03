/** @jsxImportSource @opentui/solid */

import { For, createMemo } from 'solid-js';
import { useTerminalDimensions } from '@opentui/solid';
import { cockpitTheme } from './cockpitTheme.js';

export type TabPanelTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export type TabPanelTab = {
	id: string;
	label: string;
	labelColor?: string;
};

export type TabPanelLine = {
	text: string;
	fg: string;
};

export type TabPanelBadge = {
	text: string;
	tone?: TabPanelTone;
};

type TabPanelProps = {
	focused: boolean;
	tabs: TabPanelTab[];
	selectedTabId: string | undefined;
	bodyLines: TabPanelLine[];
	bodyRows: number;
	footerBadges?: TabPanelBadge[];
};

export function TabPanel(props: TabPanelProps) {
	const terminal = useTerminalDimensions();
	const borderColor = createMemo(() => (props.focused ? cockpitTheme.accent : cockpitTheme.border));
	const panelWidth = createMemo(() => Math.max(terminal().width - 2, 20));
	const interiorWidth = createMemo(() => Math.max(panelWidth() - 2, 18));
	const tabsLeftPadding = 1;
	const tabGap = 2;
	const tabLayouts = createMemo(() => {
		const layouts: Array<{ tab: TabPanelTab; x: number; width: number }> = [];
		let cursor = tabsLeftPadding;
		for (const tab of props.tabs) {
			const width = tab.label.length + 4;
			if (layouts.length > 0) {
				cursor += tabGap;
			}
			if (cursor + width > interiorWidth()) {
				break;
			}
			layouts.push({ tab, x: cursor, width });
			cursor += width;
		}
		return layouts;
	});
	const selectedLayout = createMemo(() => {
		const selectedId = props.selectedTabId;
		return tabLayouts().find((layout) => layout.tab.id === selectedId) ?? tabLayouts()[0];
	});
	const renderedTabLayouts = createMemo(() => {
		const layouts = tabLayouts();
		return layouts.map((layout, index) => {
			const previous = layouts[index - 1];
			const previousEnd = previous ? previous.x + previous.width : 0;
			const gap = index === 0 ? layout.x + 1 : Math.max(layout.x - previousEnd, 0);
			return {
				...layout,
				gap
			};
		});
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
		const segments: Array<{ text: string; fg: string }> = [];
		const selectedId = selectedLayout()?.tab.id;
		let usedWidth = 0;

		for (const layout of renderedTabLayouts()) {
			const gapText = ' '.repeat(layout.gap);
			segments.push({ text: gapText, fg: borderColor() });
			usedWidth += gapText.length;

			if (layout.tab.id === selectedId) {
				segments.push({ text: '│ ', fg: borderColor() });
				segments.push({ text: layout.tab.label, fg: cockpitTheme.brightText });
				segments.push({ text: ' │', fg: borderColor() });
			} else {
				segments.push({ text: `  ${layout.tab.label}  `, fg: cockpitTheme.mutedText });
			}
			usedWidth += layout.width;
		}

		if (usedWidth < panelWidth()) {
			segments.push({ text: ' '.repeat(panelWidth() - usedWidth), fg: borderColor() });
		}

		return segments;
	});
	const visibleBodyLines = createMemo(() => {
		const lines = props.bodyLines.slice(0, props.bodyRows);
		while (lines.length < props.bodyRows) {
			lines.push({ text: '', fg: cockpitTheme.bodyText });
		}
		return lines;
	});
	const footerSegments = createMemo(() => renderFooterSegments(props.footerBadges ?? []));
	const footerWidth = createMemo(() => footerSegments().reduce((total, segment) => total + segment.text.length, 0));
	const footerPadding = createMemo(() => ' '.repeat(Math.max(interiorWidth() - footerWidth(), 0)));

	return (
		<box style={{ flexDirection: 'column', flexGrow: 1 }}>
			<text style={{ fg: borderColor() }}>{topTabLine()}</text>
			<box style={{ flexDirection: 'row' }}>
				<For each={tabLabelSegments()}>
					{(segment) => <text style={{ fg: segment.fg }}>{segment.text}</text>}
				</For>
			</box>
			<text style={{ fg: borderColor() }}>{topBorderLine()}</text>

			<For each={visibleBodyLines()}>
				{(line) => (
					<box style={{ flexDirection: 'row', backgroundColor: cockpitTheme.panelBackground }}>
						<text style={{ fg: borderColor() }}>│</text>
						<text style={{ fg: line.fg }}>{fitPanelText(line.text, interiorWidth())}</text>
						<text style={{ fg: borderColor() }}>│</text>
					</box>
				)}
			</For>

			<box style={{ flexDirection: 'row', backgroundColor: cockpitTheme.panelBackground }}>
				<text style={{ fg: borderColor() }}>│</text>
				<text>{footerPadding()}</text>
				<For each={footerSegments()}>
					{(segment) => <text style={{ fg: footerToneColor(segment.tone) }}>{segment.text}</text>}
				</For>
				<text style={{ fg: borderColor() }}>│</text>
			</box>

			<text style={{ fg: borderColor() }}>{bottomBorderLine()}</text>
		</box>
	);
}

function fitPanelText(text: string, width: number): string {
	return text.slice(0, width).padEnd(width, ' ');
}

function renderFooterSegments(badges: TabPanelBadge[]): Array<{ text: string; tone?: TabPanelTone }> {
	const segments: Array<{ text: string; tone?: TabPanelTone }> = [];
	for (let index = 0; index < badges.length; index += 1) {
		const badge = badges[index];
		if (!badge) {
			continue;
		}
		if (index > 0) {
			segments.push({ text: '  ' });
		}
		segments.push(badge.tone ? { text: `[${badge.text}]`, tone: badge.tone } : { text: `[${badge.text}]` });
	}
	return segments;
}

function footerToneColor(tone: TabPanelTone | undefined): string {
	if (tone === 'accent') {
		return cockpitTheme.accent;
	}
	if (tone === 'success') {
		return cockpitTheme.success;
	}
	if (tone === 'warning') {
		return cockpitTheme.warning;
	}
	if (tone === 'danger') {
		return cockpitTheme.danger;
	}
	return cockpitTheme.labelText;
}