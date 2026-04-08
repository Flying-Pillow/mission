/** @jsxImportSource @opentui/solid */

import { towerTheme } from './towerTheme.js';

type KeyHintsRowProps = {
	text: string;
};

export function KeyHintsRow(props: KeyHintsRowProps) {
	return (
		<text style={{ fg: towerTheme.mutedText }}>
			{props.text}
		</text>
	);
}