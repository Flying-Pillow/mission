/** @jsxImportSource @opentui/solid */

import { cockpitTheme } from './cockpitTheme.js';

export function KeyHintsRow() {
	return (
		<box style={{ flexDirection: 'row', gap: 2, paddingLeft: 1, paddingRight: 1 }}>
				<text style={{ fg: cockpitTheme.mutedText }}>↑ ↓ panels</text>
				<text style={{ fg: cockpitTheme.mutedText }}>↑ ↓ lane</text>
				<text style={{ fg: cockpitTheme.mutedText }}>← → select</text>
				<text style={{ fg: cockpitTheme.mutedText }}>Enter submit</text>
				<text style={{ fg: cockpitTheme.mutedText }}>/launch selected task</text>
				<text style={{ fg: cockpitTheme.mutedText }}>q quit</text>
		</box>
	);
}