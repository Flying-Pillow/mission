/** @jsxImportSource @opentui/solid */

import { For, Show, type ParentProps } from 'solid-js';
import { cockpitTheme } from './cockpitTheme.js';

type PanelStyle = Record<string, string | number | undefined>;

export type PanelBadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export type PanelBadge = {
	text: string;
	tone?: PanelBadgeTone;
	framed?: boolean;
};

type PanelProps = ParentProps<{
	title?: string;
	titleColor?: string;
	border?: boolean;
	borderColor?: string;
	backgroundColor?: string;
	footerBadges?: PanelBadge[];
	style?: PanelStyle;
	contentStyle?: PanelStyle;
}>;

export function Panel(props: PanelProps) {
	return (
		<box
			border={props.border ?? true}
			borderStyle="rounded"
			{...(props.border === false || !props.title ? {} : { title: props.title, titleAlignment: 'left' as const })}
			style={{
				flexDirection: 'column',
				paddingTop: props.border === false ? 0 : 1,
				paddingBottom: props.border === false ? 0 : 1,
				paddingLeft: 1,
				paddingRight: 1,
				borderColor: props.borderColor ?? cockpitTheme.border,
				backgroundColor: props.backgroundColor ?? cockpitTheme.panelBackground,
				...(props.style ?? {})
			}}
		>
			{props.border === false && props.title ? <text style={{ fg: props.titleColor ?? cockpitTheme.labelText }}>{props.title}</text> : null}
			<box
				style={{
					flexDirection: 'column',
					paddingTop: 0,
					paddingBottom: props.footerBadges?.length ? 1 : props.border === false ? 0 : 1,
					...(props.contentStyle ?? {})
				}}
			>
				{props.children}
			</box>
			<Show when={props.footerBadges && props.footerBadges.length > 0}>
				<box
					style={{
						flexDirection: 'row',
						justifyContent: 'flex-end',
						paddingTop: 0,
						...(props.border === false ? {} : { marginBottom: -1 })
					}}
				>
					<For each={renderBadgeLine(props.footerBadges ?? [])}>
						{(segment) => <text style={{ fg: badgeColor(segment.tone) }}>{segment.text}</text>}
					</For>
				</box>
			</Show>
		</box>
	);
}

function renderBadgeLine(badges: PanelBadge[]): Array<{ text: string; tone?: PanelBadgeTone }> {
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
		segments.push({ text: badgeText, ...(badge.tone ? { tone: badge.tone } : {}) });
	}
	return segments;
}

function badgeColor(tone: PanelBadgeTone | undefined): string {
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