import type {
	AgentMetadata,
	AgentSessionEvent,
	AgentSessionSnapshot
} from '../AgentRuntimeTypes.js';

export const MAX_AGENT_SESSION_SIGNAL_TEXT_LENGTH = 2_000;
export const MAX_AGENT_SESSION_MESSAGE_LENGTH = 8_000;
export const MAX_AGENT_SESSION_USAGE_ENTRIES = 32;
export const MAX_AGENT_SESSION_SUGGESTED_RESPONSES = 6;
export const MAX_MISSION_PROTOCOL_MARKER_LENGTH = 4_096;

export type AgentSessionSignalSource =
	| 'daemon-authoritative'
	| 'mcp-validated'
	| 'provider-structured'
	| 'agent-declared'
	| 'terminal-heuristic';

export type AgentSessionSignalConfidence =
	| 'authoritative'
	| 'high'
	| 'medium'
	| 'low'
	| 'diagnostic';

type AgentSessionSignalBase = {
	source: AgentSessionSignalSource;
	confidence: AgentSessionSignalConfidence;
};

export type AgentSessionDiagnosticCode =
	| 'provider-session'
	| 'tool-call'
	| 'protocol-marker-malformed'
	| 'protocol-marker-oversized'
	| 'terminal-heuristic';

export type AgentSessionSignal =
	| ({
			type: 'progress';
			summary: string;
			detail?: string;
	  } & AgentSessionSignalBase)
	| ({
			type: 'needs_input';
			question: string;
			suggestedResponses?: string[];
	  } & AgentSessionSignalBase)
	| ({
			type: 'blocked';
			reason: string;
	  } & AgentSessionSignalBase)
	| ({
			type: 'ready_for_verification';
			summary: string;
	  } & AgentSessionSignalBase)
	| ({
			type: 'completed_claim';
			summary: string;
	  } & AgentSessionSignalBase)
	| ({
			type: 'failed_claim';
			reason: string;
	  } & AgentSessionSignalBase)
	| ({
			type: 'message';
			channel: 'agent' | 'system' | 'stdout' | 'stderr';
			text: string;
	  } & AgentSessionSignalBase)
	| ({
			type: 'usage';
			payload: AgentMetadata;
	  } & AgentSessionSignalBase)
	| ({
			type: 'diagnostic';
			code: AgentSessionDiagnosticCode;
			summary: string;
			detail?: string;
			payload?: AgentMetadata;
	  } & AgentSessionSignalBase);

export type AgentSessionSignalScope = {
	missionId: string;
	taskId: string;
	agentSessionId: string;
};

export type AgentSessionObservationOrigin =
	| 'daemon'
	| 'mcp'
	| 'provider-output'
	| 'protocol-marker'
	| 'terminal-output';

export type AgentSessionSignalCandidate = {
	signal: AgentSessionSignal;
	dedupeKey?: string;
	claimedScope?: AgentSessionSignalScope;
	rawText?: string;
};

export type AgentSessionObservation = {
	observationId: string;
	observedAt: string;
	signal: AgentSessionSignal;
	route: {
		origin: AgentSessionObservationOrigin;
		scope: AgentSessionSignalScope;
	};
	claimedScope?: AgentSessionSignalScope;
	rawText?: string;
};

export type AgentSessionSignalDecision =
	| { action: 'reject'; reason: string }
	| { action: 'record-observation-only'; reason: string }
	| { action: 'emit-message'; event: AgentSessionEvent }
	| {
			action: 'update-session';
			eventType: 'session.updated' | 'session.awaiting-input' | 'session.completed' | 'session.failed';
			snapshotPatch: Partial<AgentSessionSnapshot>;
	  };

export function cloneSignalScope(scope: AgentSessionSignalScope): AgentSessionSignalScope {
	return {
		missionId: scope.missionId,
		taskId: scope.taskId,
		agentSessionId: scope.agentSessionId
	};
}

export function sameSignalScope(
	left: AgentSessionSignalScope,
	right: AgentSessionSignalScope
): boolean {
	return left.missionId === right.missionId
		&& left.taskId === right.taskId
		&& left.agentSessionId === right.agentSessionId;
}

export function cloneSignal(signal: AgentSessionSignal): AgentSessionSignal {
	switch (signal.type) {
		case 'progress':
			return {
				...signal,
				...(signal.detail ? { detail: signal.detail } : {})
			};
		case 'needs_input':
			return {
				...signal,
				...(signal.suggestedResponses ? { suggestedResponses: [...signal.suggestedResponses] } : {})
			};
		case 'blocked':
		case 'ready_for_verification':
		case 'completed_claim':
		case 'failed_claim':
		case 'message':
			return { ...signal };
		case 'usage':
			return {
				...signal,
				payload: { ...signal.payload }
			};
		case 'diagnostic':
			return {
				...signal,
				...(signal.payload ? { payload: { ...signal.payload } } : {})
			};
	}
}

export function isScalarAgentMetadataValue(value: unknown): value is AgentMetadata[string] {
	return value === null
		|| typeof value === 'string'
		|| typeof value === 'number'
		|| typeof value === 'boolean';
}
