import type {
	AgentContext,
	GateIntent,
	MissionBrief,
	MissionGateResult,
	MissionSelector,
	MissionStatus,
	MissionStageId,
	TrackedIssueSummary
	} from '../types.js';
import type {
	MissionAgentConsoleEvent,
	MissionAgentConsoleState,
	MissionAgentEvent,
	MissionAgentLifecycleState,
	MissionAgentSessionLaunchRequest,
	MissionAgentSessionRecord,
	MissionAgentTurnRequest
} from './MissionAgentRuntime.js';
import type { MissionTaskUpdate } from '../types.js';

export const PROTOCOL_VERSION = 3;

export type Method =
	| 'ping'
	| 'mission.bootstrap'
	| 'mission.start'
	| 'mission.status'
	| 'mission.gate.evaluate'
	| 'mission.transition'
	| 'mission.deliver'
	| 'mission.task.update'
	| 'mission.agent.sessions'
	| 'mission.agent.launch'
	| 'mission.agent.console.state'
	| 'mission.agent.turn.submit'
	| 'mission.agent.input'
	| 'mission.agent.resize'
	| 'mission.agent.cancel'
	| 'mission.agent.terminate'
	| 'github.issues.list';

export type Endpoint = {
	transport: 'ipc';
	path: string;
};

export type Manifest = {
	repoRoot: string;
	pid: number;
	startedAt: string;
	protocolVersion: typeof PROTOCOL_VERSION;
	endpoint: Endpoint;
};

export type Ping = {
	ok: true;
	repoRoot: string;
	pid: number;
	startedAt: string;
	protocolVersion: typeof PROTOCOL_VERSION;
};

export type MissionSelect = {
	selector?: MissionSelector;
};

export type MissionStart = {
	brief: MissionBrief;
	branchRef?: string;
	agentContext?: AgentContext;
};

export type MissionBootstrap = {
	issueNumber: number;
	agentContext?: AgentContext;
};

export type MissionGateEvaluate = MissionSelect & {
	intent: GateIntent;
};

export type MissionTransition = MissionSelect & {
	toStage: MissionStageId;
};

export type TaskUpdate = MissionSelect & {
	taskId: string;
	changes: MissionTaskUpdate;
};

export type AgentLaunch = MissionSelect & {
	request: Omit<MissionAgentSessionLaunchRequest, 'runtimeId'> & {
		runtimeId?: string;
	};
};

export type AgentTurnSubmit = {
	sessionId: string;
	request: MissionAgentTurnRequest;
};

export type AgentConsoleState = {
	sessionId: string;
};

export type AgentInput = {
	sessionId: string;
	text: string;
};

export type AgentResize = {
	sessionId: string;
	cols: number;
	rows: number;
};

export type AgentControl = {
	sessionId: string;
	reason?: string;
};

export type GitHubIssuesList = {
	limit?: number;
};

export type Notification =
	| {
			type: 'mission.status';
			missionId: string;
			status: MissionStatus;
	  }
	| {
			type: 'mission.agent.console';
			missionId: string;
			event: MissionAgentConsoleEvent;
	  }
	| {
			type: 'mission.agent.event';
			missionId: string;
			event: MissionAgentEvent;
	  }
	| {
			type: 'mission.agent.session';
			missionId: string;
			sessionId: string;
			phase: 'spawned' | 'active' | 'terminated';
			lifecycleState: MissionAgentLifecycleState;
	  };

export type Request = {
	type: 'request';
	id: string;
	method: Method;
	params?: unknown;
};

export type SuccessResponse = {
	type: 'response';
	id: string;
	ok: true;
	result:
		| Ping
		| MissionStatus
		| MissionGateResult
		| MissionAgentConsoleState
		| null
		| MissionAgentSessionRecord
		| MissionAgentSessionRecord[]
		| TrackedIssueSummary[];
};

export type ErrorResponse = {
	type: 'response';
	id: string;
	ok: false;
	error: {
		message: string;
	};
};

export type EventMessage = {
	type: 'event';
	event: Notification;
};

export type Response = SuccessResponse | ErrorResponse;

export type Message = Request | Response | EventMessage;