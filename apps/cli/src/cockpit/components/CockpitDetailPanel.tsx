/** @jsxImportSource @opentui/solid */

import { For, Show, createMemo } from 'solid-js';
import { Panel, type PanelBadge } from './Panel.js';
import { cockpitTheme } from './cockpitTheme.js';

type CockpitDetailPanelProps = {
	title: string;
	subtitle?: string;
	content: string;
	contentWidth?: number | undefined;
	isLoading: boolean;
	errorMessage?: string | undefined;
};

export function CockpitDetailPanel(props: CockpitDetailPanelProps) {
	const footerBadges = createMemo<PanelBadge[]>(() => {
		if (props.errorMessage) {
			return [{ text: 'error', tone: 'danger' }];
		}
		if (props.isLoading) {
			return [{ text: 'loading', tone: 'warning' }];
		}
		return [{ text: 'ready', tone: 'success' }];
	});
	const lines = createMemo(() => props.content.split(/\r?\n/u));
	const resolvedContentWidth = createMemo(() => {
		if (typeof props.contentWidth === 'number' && Number.isFinite(props.contentWidth)) {
			return Math.max(12, Math.floor(props.contentWidth));
		}
		return undefined;
	});

	return (
		<Panel
			title={`DETAIL ${props.title}`}
			titleColor={cockpitTheme.title}
			borderColor={cockpitTheme.border}
			style={{ flexGrow: 1, flexShrink: 1, minHeight: 0, minWidth: 0 }}
			contentStyle={{ flexGrow: 1, flexShrink: 1, minHeight: 0, minWidth: 0, gap: 1 }}
			footerBadges={footerBadges()}
		>
			<Show when={props.subtitle}>
				<text style={{ fg: cockpitTheme.secondaryText }}>{props.subtitle}</text>
			</Show>
			<Show when={!props.errorMessage} fallback={<text style={{ fg: cockpitTheme.danger }}>{props.errorMessage}</text>}>
				<Show when={!props.isLoading} fallback={<text style={{ fg: cockpitTheme.secondaryText }}>Loading detail content...</text>}>
					<scrollbox
						focused={false}
						style={{
							flexGrow: 1,
							flexShrink: 1,
							minHeight: 0,
							scrollbarOptions: {
								trackOptions: {
									foregroundColor: cockpitTheme.border,
									backgroundColor: cockpitTheme.panelBackground
								}
							}
						}}
					>
						<box style={{ flexDirection: 'column', minHeight: 0 }}>
							<For each={lines()}>
								{(line) => <text style={{ fg: cockpitTheme.bodyText }}>{fitDetailLine(line, resolvedContentWidth())}</text>}
							</For>
						</box>
					</scrollbox>
				</Show>
			</Show>
		</Panel>
	);
}

function fitDetailLine(text: string, width: number | undefined): string {
	const value = text.length > 0 ? text : ' ';
	if (width === undefined) {
		return value;
	}
	return value.slice(0, Math.max(1, width));
}