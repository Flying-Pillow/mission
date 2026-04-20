import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveMissionWorkspaceRoot } from './repoConfig.js';

describe('repoConfig', () => {
	beforeEach(() => {
		delete process.env['MISSIONS_PATH'];
	});

	afterEach(() => {
		delete process.env['MISSIONS_PATH'];
	});

	it('prefers MISSIONS_PATH for the default workspace root', () => {
		process.env['MISSIONS_PATH'] = '/missions';

		expect(resolveMissionWorkspaceRoot()).toBe('/missions');
		expect(resolveMissionWorkspaceRoot('missions')).toBe('/missions');
	});

	it('keeps explicit absolute mission workspace roots ahead of MISSIONS_PATH', () => {
		process.env['MISSIONS_PATH'] = '/missions';

		expect(resolveMissionWorkspaceRoot('/srv/custom-missions')).toBe('/srv/custom-missions');
	});

	it('keeps existing home-relative fallback when MISSIONS_PATH is absent', () => {
		delete process.env['MISSIONS_PATH'];

		expect(resolveMissionWorkspaceRoot()).toBe(path.resolve(os.homedir(), 'missions'));
	});
});