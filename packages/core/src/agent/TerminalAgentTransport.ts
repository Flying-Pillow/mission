import { randomUUID } from 'node:crypto';
import { spawn as spawnPty, type IPty } from 'node-pty';

export type TerminalExecutorResult = {
    stdout: string;
    stderr: string;
};

export type TerminalExecutor = (args: string[]) => Promise<TerminalExecutorResult>;

export type TerminalSessionHandle = {
    sessionName: string;
    paneId: string;
    sharedSessionName?: string | undefined;
};

export type TerminalAgentTransportOptions = {
    terminalBinary?: string;
    logLine?: (line: string) => void;
    executor?: TerminalExecutor;
    sharedSessionName?: string;
    agentSessionPaneTitle?: string;
    discoverSharedSessionName?: boolean;
    spawn?: typeof spawnPty;
};

export type TerminalOpenSessionRequest = {
    workingDirectory: string;
    command: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
    sessionPrefix?: string;
    sessionName?: string;
    sharedSessionName?: string;
};

export type TerminalSessionSnapshot = {
    sessionName: string;
    paneId: string;
    connected: boolean;
    dead: boolean;
    exitCode: number | null;
    screen: string;
    truncated: boolean;
    chunk?: string;
    sharedSessionName?: string;
};

type PtySessionRecord = {
    sessionName: string;
    paneId: string;
    pty: IPty;
    buffer: string;
    dead: boolean;
    exitCode: number | null;
    cols: number;
    rows: number;
    truncated: boolean;
};

type PtySessionUpdate = TerminalSessionSnapshot & {
    chunk: string;
};

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const MAX_BUFFER_SIZE = 200_000;
const PTY_PANE_ID = 'pty';

class PtySessionRegistry {
    private readonly sessions = new Map<string, PtySessionRecord>();
    private readonly listeners = new Set<(event: PtySessionUpdate) => void>();

    public constructor(private readonly spawnImpl: typeof spawnPty, private readonly logLine?: (line: string) => void) { }

    public openSession(request: TerminalOpenSessionRequest): TerminalSessionHandle {
        const sessionName = this.resolveSessionName(request.sessionName, request.sessionPrefix);
        const command = request.command.trim();
        if (!command) {
            throw new Error('TerminalAgentTransport requires a command.');
        }

        const pty = this.spawnImpl(command, request.args ?? [], {
            name: 'xterm-256color',
            cols: DEFAULT_COLS,
            rows: DEFAULT_ROWS,
            cwd: request.workingDirectory,
            env: buildPtyEnv(request.env)
        });
        this.logLine?.(`pty spawn ${command} ${(request.args ?? []).join(' ')}`.trim());

        const record: PtySessionRecord = {
            sessionName,
            paneId: PTY_PANE_ID,
            pty,
            buffer: '',
            dead: false,
            exitCode: null,
            cols: DEFAULT_COLS,
            rows: DEFAULT_ROWS,
            truncated: false
        };
        this.sessions.set(sessionName, record);

        pty.onData((chunk) => {
            const appended = appendToBuffer(record.buffer, chunk);
            record.buffer = appended.buffer;
            record.truncated = record.truncated || appended.truncated;
            this.emit({
                sessionName,
                paneId: record.paneId,
                connected: true,
                dead: record.dead,
                exitCode: record.exitCode,
                screen: record.buffer,
                truncated: record.truncated,
                chunk
            });
        });

        pty.onExit(({ exitCode }) => {
            record.dead = true;
            record.exitCode = exitCode;
            this.emit({
                sessionName,
                paneId: record.paneId,
                connected: true,
                dead: true,
                exitCode,
                screen: record.buffer,
                truncated: record.truncated,
                chunk: ''
            });
        });

        return {
            sessionName,
            paneId: record.paneId
        };
    }

    public attachSession(sessionName: string): TerminalSessionHandle | undefined {
        const record = this.sessions.get(sessionName);
        if (!record) {
            return undefined;
        }
        return {
            sessionName: record.sessionName,
            paneId: record.paneId
        };
    }

    public hasSession(sessionName: string): boolean {
        return this.sessions.has(sessionName);
    }

    public readSnapshot(sessionName: string): TerminalSessionSnapshot | undefined {
        const record = this.sessions.get(sessionName);
        if (!record) {
            return undefined;
        }
        return {
            sessionName: record.sessionName,
            paneId: record.paneId,
            connected: true,
            dead: record.dead,
            exitCode: record.exitCode,
            screen: record.buffer,
            truncated: record.truncated
        };
    }

    public sendKeys(sessionName: string, keys: string, options: { literal?: boolean } = {}): void {
        const record = this.requireSession(sessionName);
        record.pty.write(translateKeys(keys, options));
    }

    public resize(sessionName: string, cols: number, rows: number): void {
        const record = this.requireSession(sessionName);
        const normalizedCols = clampTerminalSize(cols, DEFAULT_COLS);
        const normalizedRows = clampTerminalSize(rows, DEFAULT_ROWS);
        if (record.cols === normalizedCols && record.rows === normalizedRows) {
            return;
        }
        record.cols = normalizedCols;
        record.rows = normalizedRows;
        record.pty.resize(normalizedCols, normalizedRows);
    }

    public killSession(sessionName: string): void {
        const record = this.sessions.get(sessionName);
        if (!record) {
            return;
        }
        try {
            record.pty.kill();
        } finally {
            record.dead = true;
            this.emit({
                sessionName: record.sessionName,
                paneId: record.paneId,
                connected: false,
                dead: true,
                exitCode: record.exitCode,
                screen: record.buffer,
                truncated: record.truncated,
                chunk: ''
            });
        }
    }

    public onDidSessionUpdate(listener: (event: PtySessionUpdate) => void): { dispose(): void } {
        this.listeners.add(listener);
        return {
            dispose: () => {
                this.listeners.delete(listener);
            }
        };
    }

    private emit(event: PtySessionUpdate): void {
        for (const listener of this.listeners) {
            listener({ ...event });
        }
    }

    private requireSession(sessionName: string): PtySessionRecord {
        const record = this.sessions.get(sessionName);
        if (!record) {
            throw new Error(`Terminal session '${sessionName}' is not active.`);
        }
        return record;
    }

    private resolveSessionName(requestedName: string | undefined, sessionPrefix: string | undefined): string {
        const baseName = requestedName?.trim() || `${sessionPrefix?.trim() || 'mission-agent'}-${randomUUID().slice(0, 8)}`;
        if (!this.sessions.has(baseName)) {
            return baseName;
        }
        for (let suffix = 2; suffix < 10_000; suffix += 1) {
            const candidate = `${baseName}-${String(suffix)}`;
            if (!this.sessions.has(candidate)) {
                return candidate;
            }
        }
        throw new Error(`Unable to allocate a unique terminal session name for '${baseName}'.`);
    }
}

export class TerminalAgentTransport {
    private static registryBySpawn = new WeakMap<typeof spawnPty, PtySessionRegistry>();

    private readonly registry: PtySessionRegistry;

    public constructor(options: TerminalAgentTransportOptions = {}) {
        const spawnImpl = options.spawn ?? spawnPty;
        this.registry = TerminalAgentTransport.getOrCreateRegistry(spawnImpl, options.logLine);
    }

    public static onDidSessionUpdate(
        listener: (event: PtySessionUpdate) => void,
        options: { spawn?: typeof spawnPty } = {}
    ): { dispose(): void } {
        return TerminalAgentTransport.getOrCreateRegistry(options.spawn ?? spawnPty).onDidSessionUpdate(listener);
    }

    public async isAvailable(): Promise<{ available: boolean; detail?: string }> {
        return {
            available: true,
            detail: 'node-pty runtime is available.'
        };
    }

    public async openSession(request: TerminalOpenSessionRequest): Promise<TerminalSessionHandle> {
        return this.registry.openSession(request);
    }

    public async attachSession(
        sessionName: string,
        _options: { sharedSessionName?: string | undefined; paneId?: string | undefined } = {}
    ): Promise<TerminalSessionHandle | undefined> {
        return this.registry.attachSession(sessionName);
    }

    public async hasSession(sessionName: string): Promise<boolean> {
        return this.registry.hasSession(sessionName);
    }

    public async sendKeys(handle: TerminalSessionHandle, keys: string, options: { literal?: boolean } = {}): Promise<void> {
        this.registry.sendKeys(handle.sessionName, keys, options);
    }

    public async resizeSession(handle: TerminalSessionHandle, cols: number, rows: number): Promise<void> {
        this.registry.resize(handle.sessionName, cols, rows);
    }

    public async capturePane(handle: TerminalSessionHandle, _startLine = -200): Promise<string> {
        return this.registry.readSnapshot(handle.sessionName)?.screen ?? '';
    }

    public async readPaneState(handle: TerminalSessionHandle): Promise<{ dead: boolean; exitCode: number | null }> {
        const snapshot = this.registry.readSnapshot(handle.sessionName);
        if (!snapshot) {
            return {
                dead: true,
                exitCode: 1
            };
        }
        return {
            dead: snapshot.dead,
            exitCode: snapshot.exitCode
        };
    }

    public async readSnapshot(handle: TerminalSessionHandle): Promise<TerminalSessionSnapshot> {
        const snapshot = this.registry.readSnapshot(handle.sessionName);
        if (!snapshot) {
            return {
                sessionName: handle.sessionName,
                paneId: handle.paneId,
                connected: false,
                dead: true,
                exitCode: null,
                screen: '',
                truncated: false
            };
        }
        return snapshot;
    }

    public async killSession(handle: TerminalSessionHandle): Promise<void> {
        this.registry.killSession(handle.sessionName);
    }

    private static getOrCreateRegistry(
        spawnImpl: typeof spawnPty,
        logLine?: (line: string) => void
    ): PtySessionRegistry {
        const existing = this.registryBySpawn.get(spawnImpl);
        if (existing) {
            return existing;
        }
        const created = new PtySessionRegistry(spawnImpl, logLine);
        this.registryBySpawn.set(spawnImpl, created);
        return created;
    }
}

function buildPtyEnv(env: NodeJS.ProcessEnv | undefined): Record<string, string> {
    const merged: NodeJS.ProcessEnv = {
        ...process.env,
        ...(env ?? {}),
        TERM: 'xterm-256color'
    };
    const output: Record<string, string> = {};
    for (const [key, value] of Object.entries(merged)) {
        if (typeof value === 'string') {
            output[key] = value;
        }
    }
    return output;
}

function translateKeys(keys: string, options: { literal?: boolean }): string {
    if (options.literal) {
        return keys;
    }
    if (keys === 'Enter') {
        return '\r';
    }
    if (keys === 'C-c') {
        return '\x03';
    }
    if (keys === 'Backspace') {
        return '\x7f';
    }
    return keys;
}

function appendToBuffer(buffer: string, chunk: string): { buffer: string; truncated: boolean } {
    const next = `${buffer}${chunk}`;
    if (next.length <= MAX_BUFFER_SIZE) {
        return { buffer: next, truncated: false };
    }
    return {
        buffer: next.slice(next.length - MAX_BUFFER_SIZE),
        truncated: true
    };
}

function clampTerminalSize(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(1, Math.floor(value));
}
