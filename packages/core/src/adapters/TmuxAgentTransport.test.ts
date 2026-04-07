import { describe, expect, it } from 'vitest';
import { TmuxAgentTransport, type TmuxAgentTransportOptions } from './TmuxAgentTransport.js';

describe('TmuxAgentTransport', () => {
	it('opens a tmux session and returns a transport handle', async () => {
		const executor: NonNullable<TmuxAgentTransportOptions['executor']> = async (args) => {
			if (args[0] === 'new-session') {
				return { stdout: 'mission-agent-test %1\n', stderr: '' };
			}
			if (args[0] === 'set-option') {
				return { stdout: '', stderr: '' };
			}
			throw new Error(`Unexpected tmux command: ${args.join(' ')}`);
		};

		const transport = new TmuxAgentTransport({ executor });
		const handle = await transport.openSession({
			workingDirectory: '/tmp/work',
			command: 'copilot',
			args: ['--experimental']
		});

		expect(handle).toEqual({
			sessionName: 'mission-agent-test',
			paneId: '%1'
		});
	});

	it('attaches to an existing session by resolving its pane id', async () => {
		const executor: NonNullable<TmuxAgentTransportOptions['executor']> = async (args) => {
			if (args[0] === 'has-session') {
				return { stdout: '', stderr: '' };
			}
			if (args[0] === 'display-message') {
				return { stdout: '%7\n', stderr: '' };
			}
			throw new Error(`Unexpected tmux command: ${args.join(' ')}`);
		};

		const transport = new TmuxAgentTransport({ executor });
		const handle = await transport.attachSession('existing-session');

		expect(handle).toEqual({
			sessionName: 'existing-session',
			paneId: '%7'
		});
	});

	it('sends literal keys to the inner process', async () => {
		const observed: string[][] = [];
		const executor: NonNullable<TmuxAgentTransportOptions['executor']> = async (args) => {
			observed.push(args);
			return { stdout: '', stderr: '' };
		};

		const transport = new TmuxAgentTransport({ executor });
		await transport.sendKeys({ sessionName: 'existing-session', paneId: '%7' }, 'hello', { literal: true });

		expect(observed).toEqual([
			['send-keys', '-t', '%7', '-l', 'hello']
		]);
	});
});