import {
	type AirportPaneOverrides,
	createDefaultPaneBindings,
	deriveAirportProjections,
	type AirportFocusState,
	type AirportProjectionSet,
	type AirportState,
	type AirportStatus,
	type AirportSubstrateState,
	type BindAirportPaneParams,
	type ConnectAirportClientParams,
	type PaneBinding,
	type AirportPaneId,
	type PersistedAirportIntent,
	derivePersistedAirportIntent,
	normalizePaneBinding,
	normalizePersistedAirportIntent,
	type ObserveAirportClientParams
} from './types.js';
import { resolveObservedPaneIdFromSubstrate } from './effects.js';
import { createDefaultTerminalManagerSubstrateState } from './terminal-manager.js';

type RepositoryScopedAirportControlOptions = {
	airportId: string;
	repositoryId: string;
	repositoryRootPath?: string;
	sessionId?: string;
	terminalSessionName: string;
	persistedIntent?: PersistedAirportIntent;
	initialSubstrateState?: AirportSubstrateState;
};

export class AirportControl {
	private state: AirportState;

	public constructor(options: RepositoryScopedAirportControlOptions) {
		const persistedIntent = normalizePersistedAirportIntent(options.persistedIntent);
		const airportId = options.airportId.trim();
		const repositoryId = options.repositoryId.trim();
		const terminalSessionName = options.terminalSessionName.trim();
		if (!airportId) {
			throw new Error('Airport control requires a repository-scoped airport id.');
		}
		if (!repositoryId) {
			throw new Error('Airport control requires a repository id.');
		}
		if (!terminalSessionName) {
			throw new Error('Airport control requires a repository-scoped terminal session name.');
		}
		const defaultPanes = createDefaultPaneBindings(repositoryId);
		const paneOverrides = normalizePaneOverrides(persistedIntent?.panes, defaultPanes);

		this.state = {
			airportId,
			repositoryId,
			...(options.repositoryRootPath?.trim() ? { repositoryRootPath: options.repositoryRootPath.trim() } : {}),
			...(options.sessionId?.trim() ? { sessionId: options.sessionId.trim() } : {}),
			defaultPanes,
			paneOverrides,
			panes: createEffectivePaneBindings(defaultPanes, paneOverrides),
			focus: persistedIntent?.focus?.intentPaneId ? { intentPaneId: persistedIntent.focus.intentPaneId } : {},
			clients: {},
			substrate: options.initialSubstrateState
				? structuredClone(options.initialSubstrateState)
				: createDefaultTerminalManagerSubstrateState({ sessionName: terminalSessionName })
		};
	}

	public scopeToRepository(options: {
		repositoryId: string;
		repositoryRootPath?: string;
		airportId: string;
		sessionName: string;
	}): AirportStatus {
		const repositoryId = options.repositoryId.trim();
		const repositoryRootPath = options.repositoryRootPath?.trim();
		const airportId = options.airportId.trim();
		const sessionName = options.sessionName.trim();
		const sameScope = this.state.repositoryId === repositoryId
			&& this.state.airportId === airportId
			&& this.state.substrate.sessionName === sessionName
			&& (this.state.repositoryRootPath ?? '') === (repositoryRootPath ?? '');
		if (sameScope) {
			return this.getStatus();
		}
		const defaultPanes = createDefaultPaneBindings(repositoryId);
		const paneOverrides = normalizePaneOverrides(this.state.paneOverrides, defaultPanes);

		this.state = {
			...this.state,
			airportId,
			repositoryId,
			...(repositoryRootPath ? { repositoryRootPath } : {}),
			defaultPanes,
			paneOverrides,
			panes: createEffectivePaneBindings(defaultPanes, paneOverrides),
			substrate: {
				...createDefaultTerminalManagerSubstrateState({ sessionName }),
				layoutIntent: this.state.substrate.layoutIntent
			}
		};
		return this.getStatus();
	}

	public getState(): AirportState {
		return structuredClone(this.state);
	}

	public getProjections(): AirportProjectionSet {
		return deriveAirportProjections(this.state);
	}

	public getStatus(): AirportStatus {
		return {
			state: this.getState(),
			projections: this.getProjections()
		};
	}

	public getPersistedIntent(): PersistedAirportIntent {
		return derivePersistedAirportIntent(this.state);
	}

	public connectClient(params: ConnectAirportClientParams): AirportStatus {
		const now = new Date().toISOString();
		const existing = this.state.clients[params.clientId];
		const clients = releaseClaimedPane(this.state.clients, params.clientId, params.paneId);
		const substrate = params.terminalPaneId !== undefined
			? assignTerminalPaneToAirportPane(this.state.substrate, params.paneId, params.terminalPaneId)
			: this.state.substrate;
		this.state = {
			...this.state,
			focus: deriveFocusState(clients, this.state.focus.intentPaneId, substrate),
			clients: {
				...clients,
				[params.clientId]: {
					clientId: params.clientId,
					connected: true,
					label: params.label?.trim() || existing?.label || 'panel',
					connectedAt: existing?.connectedAt || now,
					lastSeenAt: now,
					...(params.surfacePath?.trim()
						? { surfacePath: params.surfacePath.trim() }
						: existing?.surfacePath
							? { surfacePath: existing.surfacePath }
							: {}),
					claimedPaneId: params.paneId,
					...(existing?.focusedPaneId ? { focusedPaneId: existing.focusedPaneId } : {}),
					...(params.panelProcessId?.trim()
						? { panelProcessId: params.panelProcessId.trim() }
						: existing?.panelProcessId
							? { panelProcessId: existing.panelProcessId }
							: {})
				}
			},
			substrate
		};
		return this.getStatus();
	}

	public disconnectClient(clientId: string): AirportStatus {
		const existing = this.state.clients[clientId];
		if (!existing) {
			return this.getStatus();
		}
		const disconnectedClient: typeof existing = {
			...existing,
			connected: false,
			lastSeenAt: new Date().toISOString()
		};
		const { claimedPaneId, focusedPaneId, ...releasedClient } = disconnectedClient;
		void claimedPaneId;
		void focusedPaneId;
		const clients = {
			...this.state.clients,
			[clientId]: releasedClient
		};
		this.state = {
			...this.state,
			focus: deriveFocusState(clients, this.state.focus.intentPaneId, this.state.substrate),
			clients: {
				...clients
			}
		};
		return this.getStatus();
	}

	public observeClient(params: ObserveAirportClientParams): AirportStatus {
		const existing = this.state.clients[params.clientId];
		if (!existing) {
			throw new Error(`Airport client '${params.clientId}' is not registered.`);
		}
		const substrate = params.terminalPaneId !== undefined && existing.claimedPaneId
			? assignTerminalPaneToAirportPane(this.state.substrate, existing.claimedPaneId, params.terminalPaneId)
			: this.state.substrate;
		const clients = {
			...this.state.clients,
			[params.clientId]: {
				...existing,
				lastSeenAt: new Date().toISOString(),
				...(params.surfacePath?.trim() ? { surfacePath: params.surfacePath.trim() } : {}),
				...(params.focusedPaneId ? { focusedPaneId: params.focusedPaneId } : {})
			}
		};

		this.state = {
			...this.state,
			focus: deriveFocusState(clients, params.intentPaneId ?? this.state.focus.intentPaneId, substrate),
			clients,
			substrate
		};
		return this.getStatus();
	}

	public bindPane(params: BindAirportPaneParams): AirportStatus {
		const nextBinding = normalizePaneBinding(params.binding);
		const paneOverrides = setPaneOverride(
			this.state.paneOverrides,
			params.paneId,
			nextBinding,
			this.state.defaultPanes
		);
		this.state = {
			...this.state,
			paneOverrides,
			panes: createEffectivePaneBindings(this.state.defaultPanes, paneOverrides)
		};
		return this.getStatus();
	}

	public applyDefaultBindings(
		bindings: Partial<Record<AirportPaneId, PaneBinding>>,
		options: { focusIntent?: AirportPaneId } = {}
	): AirportStatus {
		const defaultPanes = {
			...this.state.defaultPanes,
			...(bindings.tower ? { tower: normalizePaneBinding(bindings.tower) } : {}),
			...(bindings.briefingRoom ? { briefingRoom: normalizePaneBinding(bindings.briefingRoom) } : {}),
			...(bindings.runway ? { runway: normalizePaneBinding(bindings.runway) } : {})
		};
		const paneOverrides = normalizePaneOverrides(this.state.paneOverrides, defaultPanes);
		this.state = {
			...this.state,
			defaultPanes,
			paneOverrides,
			panes: createEffectivePaneBindings(defaultPanes, paneOverrides),
			focus: deriveFocusState(this.state.clients, options.focusIntent ?? this.state.focus.intentPaneId, this.state.substrate)
		};
		return this.getStatus();
	}

	public observeSubstrate(substrate: AirportSubstrateState): AirportStatus {
		this.state = {
			...this.state,
			substrate: structuredClone(substrate),
			focus: deriveFocusState(this.state.clients, this.state.focus.intentPaneId, substrate)
		};
		return this.getStatus();
	}
}

function createEffectivePaneBindings(
	defaultPanes: Record<AirportPaneId, PaneBinding>,
	paneOverrides: AirportPaneOverrides
): Record<AirportPaneId, PaneBinding> {
	return {
		...defaultPanes,
		...(paneOverrides.briefingRoom ? { briefingRoom: paneOverrides.briefingRoom } : {}),
		...(paneOverrides.runway ? { runway: paneOverrides.runway } : {})
	};
}

function normalizePaneOverrides(
	overrides: AirportPaneOverrides | undefined,
	defaultPanes: Record<AirportPaneId, PaneBinding>
): AirportPaneOverrides {
	const normalizedOverrides: AirportPaneOverrides = {};
	for (const paneId of ['briefingRoom', 'runway'] as const) {
		const override = overrides?.[paneId];
		if (!override) {
			continue;
		}
		const normalizedOverride = normalizePaneBinding(override);
		if (arePaneBindingsEqual(normalizedOverride, defaultPanes[paneId])) {
			continue;
		}
		normalizedOverrides[paneId] = normalizedOverride;
	}
	return normalizedOverrides;
}

function setPaneOverride(
	overrides: AirportPaneOverrides,
	paneId: Exclude<AirportPaneId, 'tower'>,
	binding: PaneBinding,
	defaultPanes: Record<AirportPaneId, PaneBinding>
): AirportPaneOverrides {
	const nextOverrides = { ...overrides };
	if (arePaneBindingsEqual(binding, defaultPanes[paneId])) {
		delete nextOverrides[paneId];
		return nextOverrides;
	}
	nextOverrides[paneId] = binding;
	return nextOverrides;
}

function arePaneBindingsEqual(left: PaneBinding, right: PaneBinding): boolean {
	return left.targetKind === right.targetKind
		&& (left.targetId ?? '') === (right.targetId ?? '')
		&& (left.mode ?? '') === (right.mode ?? '');
}

function releaseClaimedPane(
	clients: AirportState['clients'],
	clientId: string,
	paneId: AirportPaneId
): AirportState['clients'] {
	const nextClients = { ...clients };
	for (const [candidateClientId, client] of Object.entries(clients)) {
		if (candidateClientId === clientId || !client.connected || client.claimedPaneId !== paneId) {
			continue;
		}
		const { claimedPaneId, ...releasedClient } = client;
		void claimedPaneId;
		nextClients[candidateClientId] = releasedClient;
	}
	return nextClients;
}

function deriveFocusState(
	clients: AirportState['clients'],
	intentPaneId: AirportPaneId | undefined,
	substrate: AirportSubstrateState
): AirportFocusState {
	const observedClients = Object.values(clients)
		.filter((client) => client.connected && client.focusedPaneId)
		.sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt) || left.clientId.localeCompare(right.clientId));
	const observedPaneIdByClientId = Object.fromEntries(
		observedClients.map((client) => [client.clientId, client.focusedPaneId as AirportPaneId])
	);
	const observedPaneId = resolveObservedPaneIdFromSubstrate(substrate) ?? observedClients[0]?.focusedPaneId;
	return {
		...(intentPaneId ? { intentPaneId } : {}),
		...(observedPaneId ? { observedPaneId } : {}),
		...(Object.keys(observedPaneIdByClientId).length > 0 ? { observedPaneIdByClientId } : {})
	};
}

function assignTerminalPaneToAirportPane(
	substrate: AirportSubstrateState,
	paneId: AirportPaneId,
	terminalPaneId: number
): AirportSubstrateState {
	if (!Number.isInteger(terminalPaneId) || terminalPaneId < 0) {
		return substrate;
	}

	const nextPanes = Object.fromEntries(
		(Object.entries(substrate.panes) as Array<[AirportPaneId, AirportSubstrateState['panes'][AirportPaneId]]>).map(
			([candidatePaneId, pane]) => {
				if (!pane || pane.terminalPaneId !== terminalPaneId || candidatePaneId === paneId) {
					return [candidatePaneId, pane];
				}

				return [candidatePaneId, { ...pane, exists: false }];
			}
		)
	) as AirportSubstrateState['panes'];
	const currentPane = nextPanes[paneId];

	return {
		...substrate,
		panes: {
			...nextPanes,
			[paneId]: {
				terminalPaneId,
				expected: currentPane?.expected ?? true,
				exists: substrate.attached,
				...(currentPane?.title ? { title: currentPane.title } : {})
			}
		}
	};
}