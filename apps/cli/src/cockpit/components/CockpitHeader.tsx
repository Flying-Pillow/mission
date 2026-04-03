/** @jsxImportSource @opentui/solid */

import { cockpitTheme } from './cockpitTheme.js';
import { Panel, type PanelBadgeTone } from './Panel.js';

const HEADER_BORDER_PURPLE = '#a855f7';

type PanelStyle = Record<string, string | number | undefined>;

type CockpitHeaderProps = {
	title: string;
	missionStatus: string;
	stageLabel: string;
	taskLabel: string;
	connectionLabel: string;
	connectionColor: string;
	style?: PanelStyle;
};

export function CockpitHeader(props: CockpitHeaderProps) {
	return (
		<Panel
			title="MISSION"
			titleColor={cockpitTheme.title}
			borderColor={HEADER_BORDER_PURPLE}
			backgroundColor={cockpitTheme.headerBackground}
			style={{ height: 6, ...(props.style ?? {}) }}
			contentStyle={{ gap: 1 }}
			footerBadges={[
				{ text: `stage ${props.stageLabel}`, tone: 'accent' },
				{ text: `task ${props.taskLabel}` },
				{ text: '●', tone: connectionTone(props.connectionColor), framed: false }
			]}
		>
			<text style={{ fg: cockpitTheme.brightText }}>{props.title}</text>
			<text style={{ fg: cockpitTheme.metaText }}>{props.missionStatus}</text>
		</Panel>
	);
}

function connectionTone(color: string): PanelBadgeTone {
	if (color === cockpitTheme.success) {
		return 'success';
	}
	if (color === cockpitTheme.warning) {
		return 'warning';
	}
	if (color === cockpitTheme.danger) {
		return 'danger';
	}
	return 'accent';
}