import { performance } from 'node:perf_hooks';
import type { AirportPaneId, AirportPaneState, AirportState, AirportSubstrateState } from '../../airport/types.js';

const PANE_DISPLAY_TITLES: Record<AirportPaneId, string> = {
    tower: 'TOWER',
    briefingRoom: 'BRIEFING ROOM',
    runway: 'RUNWAY'
};

export type AirportSubstrateEffect = {
    kind: 'focus-pane';
    paneId: AirportPaneId;
    terminalPaneId: number;
};

export interface AirportSubstrateController {
    getState(): AirportSubstrateState;
    observe(state: AirportState): Promise<AirportSubstrateState>;
    applyEffects(effects: AirportSubstrateEffect[]): Promise<AirportSubstrateState>;
}

export type ClientReportedSubstrateOptions = {
    sessionName: string;
};

export function planAirportSubstrateEffects(state: AirportState): AirportSubstrateEffect[] {
    const effects: AirportSubstrateEffect[] = [];

    const intentPaneId = state.focus.intentPaneId;
    if (!intentPaneId) {
        return effects;
    }

    const observedPaneId = resolveObservedPaneIdFromSubstrate(state.substrate) ?? state.focus.observedPaneId;
    if (observedPaneId === intentPaneId) {
        return effects;
    }

    const pane = state.substrate.panes[intentPaneId];
    if (!pane?.exists || pane.terminalPaneId < 0) {
        return effects;
    }

    effects.push({ kind: 'focus-pane', paneId: intentPaneId, terminalPaneId: pane.terminalPaneId });
    return effects;
}

export function resolveObservedPaneIdFromSubstrate(substrate: AirportSubstrateState): AirportPaneId | undefined {
    if (substrate.observedFocusedTerminalPaneId === undefined) {
        return undefined;
    }

    for (const [paneId, pane] of Object.entries(substrate.panes) as Array<[AirportPaneId, AirportSubstrateState['panes'][AirportPaneId]]>) {
        if (pane?.exists && pane.terminalPaneId === substrate.observedFocusedTerminalPaneId) {
            return paneId;
        }
    }

    return undefined;
}

export class ClientReportedSubstrateController implements AirportSubstrateController {
    private state: AirportSubstrateState;

    public constructor(options: ClientReportedSubstrateOptions) {
        this.state = createDefaultTerminalManagerSubstrateState(options);
    }

    public getState(): AirportSubstrateState {
        return structuredClone(this.state);
    }

    public async observe(state: AirportState): Promise<AirportSubstrateState> {
        const startedAt = performance.now();
        const now = new Date().toISOString();
        this.state = buildClientReportedState(state, now);
        const durationMs = performance.now() - startedAt;
        process.stdout.write(
            `${new Date().toISOString().slice(11, 19)} airport-substrate.observe session=${this.state.sessionName} attached=${String(this.state.attached)} duration=${durationMs.toFixed(1)}ms paneCount=${String(Object.keys(this.state.panes).length)}\n`
        );
        return this.getState();
    }

    public async applyEffects(effects: AirportSubstrateEffect[]): Promise<AirportSubstrateState> {
        const startedAt = performance.now();
        const focusEffect = effects[0];
        this.state = {
            ...this.state,
            ...(focusEffect ? { observedFocusedTerminalPaneId: focusEffect.terminalPaneId } : {}),
            lastAppliedAt: new Date().toISOString()
        };
        const durationMs = performance.now() - startedAt;
        process.stdout.write(
            `${new Date().toISOString().slice(11, 19)} airport-substrate.applyEffects session=${this.state.sessionName} effects=${String(effects.length)} duration=${durationMs.toFixed(1)}ms\n`
        );
        return this.getState();
    }
}

export class InMemoryClientReportedSubstrateController implements AirportSubstrateController {
    private state: AirportSubstrateState;

    public constructor(options: { sessionName: string }) {
        this.state = createDefaultTerminalManagerSubstrateState(options);
    }

    public getState(): AirportSubstrateState {
        return structuredClone(this.state);
    }

    public observe(_state: AirportState): Promise<AirportSubstrateState> {
        const now = new Date().toISOString();
        this.state = {
            ...this.state,
            attached: true,
            lastObservedAt: now
        };
        return Promise.resolve(this.getState());
    }

    public applyEffects(effects: AirportSubstrateEffect[]): Promise<AirportSubstrateState> {
        const focusEffect = effects[0];
        this.state = {
            ...this.state,
            ...(focusEffect ? { observedFocusedTerminalPaneId: focusEffect.terminalPaneId } : {}),
            lastAppliedAt: new Date().toISOString()
        };
        return Promise.resolve(this.getState());
    }
}

export function createDefaultTerminalManagerSubstrateState(options: { sessionName: string }): AirportSubstrateState {
    const sessionName = options.sessionName.trim();
    if (!sessionName) {
        throw new Error('Airport substrate requires a repository-scoped terminal session name.');
    }

    return {
        kind: 'terminal-manager',
        sessionName,
        layoutIntent: 'mission-control-v1',
        attached: false,
        panes: {}
    };
}

function buildClientReportedState(state: AirportState, now: string): AirportSubstrateState {
    const currentState = state.substrate;
    const connectedClients = Object.values(state.clients).filter((client) => client.connected);
    const attached = connectedClients.length > 0;
    const focusedPaneId = resolveFocusedTerminalPaneIdFromClients(state);
    const panesById = Object.fromEntries(
        (Object.keys(PANE_DISPLAY_TITLES) as AirportPaneId[]).map((paneId) => {
            const expected = isAirportPaneExpected(state, paneId);
            const currentPane = currentState.panes[paneId];
            const pane = resolveClientReportedPane(state, paneId, currentPane);
            return [
                paneId,
                pane
                    ? {
                        terminalPaneId: pane.terminalPaneId,
                        expected,
                        exists: pane.exists,
                        title: pane.title
                    }
                    : {
                        terminalPaneId: currentPane?.terminalPaneId ?? -1,
                        expected,
                        exists: false,
                        title: currentPane?.title ?? PANE_DISPLAY_TITLES[paneId]
                    }
            ] as const;
        })
    ) as Partial<Record<AirportPaneId, AirportPaneState>>;

    return {
        ...currentState,
        attached,
        panes: panesById,
        ...(currentState.lastAppliedAt ? { lastAppliedAt: currentState.lastAppliedAt } : {}),
        lastObservedAt: now,
        ...(focusedPaneId !== undefined
            ? { observedFocusedTerminalPaneId: focusedPaneId }
            : {})
    };
}

function resolveClientReportedPane(
    state: AirportState,
    paneId: AirportPaneId,
    currentPane: AirportPaneState | undefined
): AirportPaneState | undefined {
    const claimedClient = Object.values(state.clients)
        .filter((client) => client.connected && client.claimedPaneId === paneId)
        .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt) || left.clientId.localeCompare(right.clientId))[0];
    const terminalPaneId = currentPane?.terminalPaneId ?? -1;
    if (!claimedClient && terminalPaneId < 0) {
        return undefined;
    }
    return {
        terminalPaneId,
        expected: isAirportPaneExpected(state, paneId),
        exists: Boolean(claimedClient),
        title: currentPane?.title ?? PANE_DISPLAY_TITLES[paneId]
    };
}

function resolveFocusedTerminalPaneIdFromClients(state: AirportState): number | undefined {
    const focusedClient = Object.values(state.clients)
        .filter((client) => client.connected && client.focusedPaneId)
        .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt) || left.clientId.localeCompare(right.clientId))[0];
    if (!focusedClient?.focusedPaneId) {
        return undefined;
    }
    const pane = state.substrate.panes[focusedClient.focusedPaneId];
    return pane && pane.terminalPaneId >= 0 ? pane.terminalPaneId : undefined;
}

function isAirportPaneExpected(state: AirportState, paneId: AirportPaneId): boolean {
    void state;
    void paneId;
    return true;
}
