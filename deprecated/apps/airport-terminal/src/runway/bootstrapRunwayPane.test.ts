import { describe, expect, it } from 'vitest';
import { buildRunwayAttachArgs } from './bootstrapRunwayPane.js';

describe('buildRunwayAttachArgs', () => {
	it('attaches the runway session with pane frames disabled', () => {
		expect(buildRunwayAttachArgs('target-session')).toEqual([
			'attach',
			'target-session',
			'options',
			'--pane-frames',
			'false'
		]);
	});
});