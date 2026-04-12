#!/usr/bin/env node

import { routeMissionEntry } from '@flying-pillow/mission-airport-terminal';

void routeMissionEntry().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});