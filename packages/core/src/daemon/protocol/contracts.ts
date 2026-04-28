import type {
	SystemSnapshot,
} from '../../types.js';
import type { Mission } from '../../entities/Mission/Mission.js';
import type { WorkflowSettingsUpdateRequest } from '../../settings/types.js';
import type {
	EntityCommandInvocation,
	EntityFormInvocation,
	EntityQueryInvocation,
	EntityRemoteResult
} from './entityRemote.js';
import type {
	EntityEventAddress,
	EntityId
} from '../../entities/Entity/Entity.js';
import type {
	AgentSessionEntityReference,
	MissionAgentSessionSnapshot
} from '../../entities/AgentSession/AgentSessionSchema.js';
import type {
	ArtifactEntityReference,
	MissionArtifactSnapshot
} from '../../entities/Artifact/ArtifactSchema.js';
import type {
	MissionActionListSnapshot,
	MissionEntityReference,
	MissionSnapshot
} from '../../entities/Mission/MissionSchema.js';
import type {
	MissionStageSnapshot,
	StageEntityReference
} from '../../entities/Stage/StageSchema.js';
import type {
	MissionTaskSnapshot,
	TaskEntityReference
} from '../../entities/Task/TaskSchema.js';

export {
	METHOD_METADATA,
	PROTOCOL_VERSION
} from './operations.js';
export type {
	Method,
	MethodMetadata,
	MethodWorkspaceRoute
} from './operations.js';
export type {
	Endpoint,
	ErrorResponse,
	EventMessage,
	Manifest,
	Message,
	Ping,
	Request,
	Response,
	SuccessResponse
} from './transport.js';

export type MissionAgentPrimitiveValue = string | number | boolean | null;

export type MissionAgentConsoleState = {
	title?: string;
	lines: string[];
	promptOptions: string[] | null;
	awaitingInput: boolean;
	runnerId?: string;
	runnerLabel?: string;
	sessionId?: string;
};

export type MissionAgentTerminalState = {
	sessionId: string;
	connected: boolean;
	dead: boolean;
	exitCode: number | null;
	screen: string;
	truncated?: boolean;
	chunk?: string;
	terminalHandle?: {
		sessionName: string;
		paneId: string;
		sharedSessionName?: string;
	};
};

export type MissionAgentConsoleEvent =
	| {
		type: 'reset';
		state: MissionAgentConsoleState;
	}
	| {
		type: 'lines';
		lines: string[];
		state: MissionAgentConsoleState;
	}
	| {
		type: 'prompt';
		state: MissionAgentConsoleState;
	};

export type MissionAgentLifecycleState =
	| 'idle'
	| 'starting'
	| 'running'
	| 'awaiting-input'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'terminated';

export type MissionAgentPermissionKind =
	| 'input'
	| 'tool'
	| 'filesystem'
	| 'command'
	| 'unknown';

export type MissionAgentPermissionRequest = {
	id: string;
	kind: MissionAgentPermissionKind;
	prompt: string;
	options: string[];
	providerDetails?: Record<string, MissionAgentPrimitiveValue>;
};

export type MissionAgentModelInfo = {
	id?: string;
	family?: string;
	provider?: string;
	displayName?: string;
};

export type MissionAgentTelemetrySnapshot = {
	model?: MissionAgentModelInfo;
	providerSessionId?: string;
	tokenUsage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
	contextWindow?: {
		usedTokens?: number;
		maxTokens?: number;
		utilization?: number;
	};
	estimatedCostUsd?: number;
	activeToolName?: string;
	updatedAt: string;
};

export type MissionAgentScope =
	| {
		kind: 'control';
		workspaceRoot?: string;
		repoName?: string;
		branch?: string;
	}
	| {
		kind: 'mission';
		missionId?: string;
		stage?: string;
		currentSlice?: string;
		readyTaskIds?: string[];
		readyTaskTitle?: string;
		readyTaskInstruction?: string;
	}
	| {
		kind: 'artifact';
		missionId?: string;
		stage?: string;
		artifactKey: string;
		artifactPath?: string;
		checkpoint?: string;
		validation?: string;
	}
	| {
		kind: 'slice';
		missionId?: string;
		missionDir?: string;
		stage?: string;
		sliceTitle: string;
		sliceId?: string;
		taskId?: string;
		taskTitle?: string;
		taskSummary?: string;
		taskInstruction?: string;
		doneWhen?: string[];
		stopCondition?: string;
		verificationTargets: string[];
		requiredSkills: string[];
		dependsOn: string[];
	}
	| {
		kind: 'gate';
		missionId?: string;
		stage?: string;
		intent: string;
	};

export type MissionAgentTurnRequest = {
	workingDirectory: string;
	prompt: string;
	scope?: MissionAgentScope;
	title?: string;
	operatorIntent?: string;
	startFreshSession?: boolean;
};

export type MissionAgentSessionState = {
	runnerId: string;
	transportId?: string;
	runnerLabel: string;
	sessionId: string;
	sessionLogPath?: string;
	terminalSessionName?: string;
	terminalPaneId?: string;
	lifecycleState: MissionAgentLifecycleState;
	workingDirectory?: string;
	currentTurnTitle?: string;
	scope?: MissionAgentScope;
	awaitingPermission?: MissionAgentPermissionRequest;
	telemetry?: MissionAgentTelemetrySnapshot;
	failureMessage?: string;
	lastUpdatedAt: string;
};

export type MissionAgentSessionRecord = {
	sessionId: string;
	runnerId: string;
	transportId?: string;
	runnerLabel: string;
	sessionLogPath?: string;
	terminalSessionName?: string;
	terminalPaneId?: string;
	lifecycleState: MissionAgentLifecycleState;
	taskId?: string;
	assignmentLabel?: string;
	workingDirectory?: string;
	currentTurnTitle?: string;
	scope?: MissionAgentScope;
	telemetry?: MissionAgentTelemetrySnapshot;
	failureMessage?: string;
	createdAt: string;
	lastUpdatedAt: string;
};

export type MissionAgentSessionLaunchRequest = MissionAgentTurnRequest & {
	runnerId: string;
	terminalSessionName?: string;
	transportId?: string;
	sessionId?: string;
	taskId?: string;
	assignmentLabel?: string;
};

export type MissionAgentEvent =
	| {
		type: 'session-state-changed';
		state: MissionAgentSessionState;
	}
	| {
		type: 'prompt-accepted';
		prompt: string;
		state: MissionAgentSessionState;
	}
	| {
		type: 'prompt-rejected';
		prompt: string;
		reason: string;
		state: MissionAgentSessionState;
	}
	| {
		type: 'session-started';
		state: MissionAgentSessionState;
	}
	| {
		type: 'session-resumed';
		state: MissionAgentSessionState;
	}
	| {
		type: 'agent-message';
		channel: 'stdout' | 'stderr' | 'system';
		text: string;
		state: MissionAgentSessionState;
	}
	| {
		type: 'permission-requested';
		request: MissionAgentPermissionRequest;
		state: MissionAgentSessionState;
	}
	| {
		type: 'tool-started';
		toolName: string;
		summary?: string;
		state: MissionAgentSessionState;
	}
	| {
		type: 'tool-finished';
		toolName: string;
		summary?: string;
		state: MissionAgentSessionState;
	}
	| {
		type: 'telemetry-updated';
		telemetry: MissionAgentTelemetrySnapshot;
		state: MissionAgentSessionState;
	}
	| {
		type: 'context-updated';
		telemetry: MissionAgentTelemetrySnapshot;
		state: MissionAgentSessionState;
	}
	| {
		type: 'cost-updated';
		telemetry: MissionAgentTelemetrySnapshot;
		state: MissionAgentSessionState;
	}
	| {
		type: 'session-completed';
		exitCode: number;
		state: MissionAgentSessionState;
	}
	| {
		type: 'session-failed';
		errorMessage: string;
		exitCode?: number;
		state: MissionAgentSessionState;
	}
	| {
		type: 'session-cancelled';
		reason?: string;
		state: MissionAgentSessionState;
	};

export type EntityQueryRequest = EntityQueryInvocation;
export type EntityCommandRequest = EntityCommandInvocation | EntityFormInvocation;
export type EntityQueryResponse = EntityRemoteResult;
export type EntityCommandResponse = EntityRemoteResult;

export type Notification =
	| {
		type: 'airport.state';
		snapshot: SystemSnapshot;
	}
	| {
		type: 'mission.actions.changed';
		workspaceRoot: string;
		missionId: string;
		revision: string;
		reference?: MissionEntityReference;
		actions?: MissionActionListSnapshot;
	}
	| {
		type: 'mission.snapshot.changed';
		workspaceRoot: string;
		missionId: string;
		reference: MissionEntityReference;
		snapshot: MissionSnapshot;
	}
	| {
		type: 'mission.status';
		workspaceRoot: string;
		missionId: string;
		status: Mission;
	}
	| {
		type: 'stage.snapshot.changed';
		workspaceRoot: string;
		missionId: string;
		reference: StageEntityReference;
		snapshot: MissionStageSnapshot;
	}
	| {
		type: 'task.snapshot.changed';
		workspaceRoot: string;
		missionId: string;
		reference: TaskEntityReference;
		snapshot: MissionTaskSnapshot;
	}
	| {
		type: 'artifact.snapshot.changed';
		workspaceRoot: string;
		missionId: string;
		reference: ArtifactEntityReference;
		snapshot: MissionArtifactSnapshot;
	}
	| {
		type: 'agentSession.snapshot.changed';
		workspaceRoot: string;
		missionId: string;
		reference: AgentSessionEntityReference;
		snapshot: MissionAgentSessionSnapshot;
	}
	| {
		type: 'mission.terminal';
		workspaceRoot: string;
		missionId: string;
		state: MissionAgentTerminalState;
	}
	| {
		type: 'session.console';
		missionId: string;
		sessionId: string;
		event: MissionAgentConsoleEvent;
	}
	| {
		type: 'session.terminal';
		missionId: string;
		sessionId: string;
		state: MissionAgentTerminalState;
	}
	| {
		type: 'session.event';
		missionId: string;
		sessionId: string;
		event: MissionAgentEvent;
	}
	| {
		type: 'session.lifecycle';
		missionId: string;
		sessionId: string;
		phase: 'spawned' | 'active' | 'terminated';
		lifecycleState: MissionAgentLifecycleState;
	}
	| {
		type: 'control.workflow.settings.updated';
		revision: string;
		changedPaths: string[];
		context: WorkflowSettingsUpdateRequest['context'];
	};

export type AddressedNotification = Notification & EntityEventAddress & {
	occurredAt: string;
	missionEntityId?: EntityId;
};

export type EventSubscription = {
	channels?: string[];
};

