#!/usr/bin/env node

import { routeMissionEntry } from './main.js';

void routeMissionEntry().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});