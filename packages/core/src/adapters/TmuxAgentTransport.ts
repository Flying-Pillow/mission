import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type TmuxExecutorResult = {
	stdout: string;
	stderr: string;
};

export type TmuxExecutor = (args: string[]) => Promise<TmuxExecutorResult>;

export type TmuxSessionHandle = {
	sessionName: string;
	paneId: string;
};

export type TmuxAgentTransportOptions = {
	tmuxBinary?: string;
	logLine?: (line: string) => void;
	executor?: TmuxExecutor;
};

export type TmuxOpenSessionRequest = {
	workingDirectory: string;
	command: string;
	args?: string[];
	env?: NodeJS.ProcessEnv;
	sessionPrefix?: string;
};

export class TmuxAgentTransport {
	private readonly logLine: ((line: string) => void) | undefined;
	private readonly executor: TmuxExecutor;

	public constructor(options: TmuxAgentTransportOptions = {}) {
		this.logLine = options.logLine;
		const tmuxBinary = options.tmuxBinary?.trim() || 'tmux';
		this.executor = options.executor ?? (async (args) => {
			const result = await execFileAsync(tmuxBinary, args, {
				encoding: 'utf8',
				env: process.env
			});
			return {
				stdout: result.stdout,
				stderr: result.stderr
			};
		});
	}

	public async isAvailable(): Promise<{ available: boolean; detail?: string }> {
		try {
			const result = await this.runTmux(['-V']);
			return {
				available: true,
				detail: result.stdout.trim() || 'tmux is available.'
			};
		} catch (error) {
			return {
				available: false,
				detail: error instanceof Error ? error.message : String(error)
			};
		}
	}

	public async openSession(request: TmuxOpenSessionRequest): Promise<TmuxSessionHandle> {
		const sessionPrefix = request.sessionPrefix?.trim() || 'mission-agent';
		const sessionName = `${sessionPrefix}-${randomUUID()}`;
		const launchCommand = buildLaunchCommand(request);
		const startResult = await this.runTmux([
			'new-session',
			'-d',
			'-P',
			'-F',
			'#{session_name} #{pane_id}',
			'-s',
			sessionName,
			'-c',
			request.workingDirectory,
			launchCommand
		]);
		const parsed = parseTmuxStartOutput(startResult.stdout);
		if (!parsed) {
			throw new Error(`TmuxAgentTransport could not parse tmux session output: ${startResult.stdout.trim()}`);
		}
		await this.runTmux(['set-option', '-t', `${parsed.sessionName}:0`, 'remain-on-exit', 'on']);
		return parsed;
	}

	public async attachSession(sessionName: string): Promise<TmuxSessionHandle | undefined> {
		const exists = await this.hasSession(sessionName);
		if (!exists) {
			return undefined;
		}
		return {
			sessionName,
			paneId: await this.resolvePaneId(sessionName)
		};
	}

	public async sendKeys(handle: TmuxSessionHandle, keys: string, options: { literal?: boolean } = {}): Promise<void> {
		await this.runTmux([
			'send-keys',
			'-t',
			handle.paneId,
			...(options.literal ? ['-l'] : []),
			keys
		]);
	}

	public async capturePane(handle: TmuxSessionHandle, startLine = -200): Promise<string> {
		const result = await this.runTmux(['capture-pane', '-p', '-t', handle.paneId, '-S', String(startLine)]);
		return result.stdout.replace(/\r\n/g, '\n');
	}

	public async readPaneState(handle: TmuxSessionHandle): Promise<{ dead: boolean; exitCode: number }> {
		const result = await this.runTmux(['display-message', '-p', '-t', handle.paneId, '#{pane_dead} #{pane_dead_status}']);
		const [deadValue, exitValue] = result.stdout.trim().split(/\s+/, 2);
		return {
			dead: deadValue === '1',
			exitCode: Number.parseInt(exitValue ?? '0', 10) || 0
		};
	}

	public async killSession(handle: TmuxSessionHandle): Promise<void> {
		try {
			await this.runTmux(['kill-session', '-t', handle.sessionName]);
		} catch {
			// Best effort. Callers own lifecycle normalization.
		}
	}

	public async hasSession(sessionName: string): Promise<boolean> {
		try {
			await this.runTmux(['has-session', '-t', sessionName]);
			return true;
		} catch {
			return false;
		}
	}

	private async resolvePaneId(sessionName: string): Promise<string> {
		const result = await this.runTmux(['display-message', '-p', '-t', sessionName, '#{pane_id}']);
		const paneId = result.stdout.trim();
		if (!paneId) {
			throw new Error(`TmuxAgentTransport could not resolve a pane for session '${sessionName}'.`);
		}
		return paneId;
	}

	private async runTmux(args: string[]): Promise<TmuxExecutorResult> {
		this.logLine?.(`tmux ${args.join(' ')}`);
		return this.executor(args);
	}
}

function buildLaunchCommand(request: TmuxOpenSessionRequest): string {
	const command = request.command.trim();
	if (!command) {
		throw new Error('TmuxAgentTransport requires a command.');
	}
	const envAssignments = Object.entries(request.env ?? {})
		.filter(([, value]) => typeof value === 'string' && value.length > 0)
		.map(([key, value]) => `${key}=${shellEscape(value as string)}`);
	const commandParts = [command, ...(request.args ?? [])].map(shellEscape);
	return envAssignments.length > 0
		? `env ${envAssignments.join(' ')} ${commandParts.join(' ')}`
		: commandParts.join(' ');
}

function parseTmuxStartOutput(output: string): TmuxSessionHandle | undefined {
	const [sessionName, paneId] = output.trim().split(/\s+/, 2);
	if (!sessionName || !paneId) {
		return undefined;
	}
	return { sessionName, paneId };
}

function shellEscape(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}