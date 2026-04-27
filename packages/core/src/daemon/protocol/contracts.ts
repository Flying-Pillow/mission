import type {
	SystemSnapshot,
	GateIntent,
	OperatorActionExecutionStep,
	OperatorActionQueryContext,
	MissionBrief,
	MissionSelector,
	OperatorStatus
} from '../../types.js';
import type { Mission } from '../../entities/Mission/Mission.js';
import type {
	AgentCommand,
	AgentPrompt
} from '../runtime/agent/AgentRuntimeTypes.js';
import type {
	WorkflowSettingsInitializeRequest,
	WorkflowSettingsInitializeResult,
	WorkflowSettingsUpdateRequest,
	WorkflowSettingsUpdateResult
} from '../../settings/types.js';
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
} from '../../entities/AgentSession/AgentSessionContract.js';
import type {
	ArtifactEntityReference,
	MissionArtifactSnapshot
} from '../../entities/Artifact/ArtifactContract.js';
import type {
	MissionActionListSnapshot,
	MissionEntityReference,
	MissionSnapshot
} from '../../entities/Mission/MissionContract.js';
import type {
	MissionStageSnapshot,
	StageEntityReference
} from '../../entities/Stage/StageContract.js';
import type {
	MissionTaskSnapshot,
	TaskEntityReference
} from '../../entities/Task/TaskContract.js';

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

export type MissionSelect = {
	selector?: MissionSelector;
};

export type MissionFromBriefRequest = {
	brief: MissionBrief;
	branchRef?: string;
};

export type MissionFromIssueRequest = {
	issueNumber: number;
};

export type ControlSettingsUpdate = {
	field: 'agentRunner' | 'defaultAgentMode' | 'defaultModel' | 'towerTheme' | 'missionWorkspaceRoot' | 'instructionsPath' | 'skillsPath';
	value: string;
};

export type ControlDocumentRead = {
	filePath: string;
};

export type ControlDocumentWrite = {
	filePath: string;
	content: string;
};

export type SessionComplete = SessionSelect;

export type ControlDocumentResponse = {
	filePath: string;
	content: string;
	updatedAt?: string;
};

export type ControlWorkflowSettingsGet = Record<string, never>;

export type ControlStatus = {
	includeMissions?: boolean;
};

export type EntityQueryRequest = EntityQueryInvocation;
export type EntityCommandRequest = EntityCommandInvocation | EntityFormInvocation;
export type EntityQueryResponse = EntityRemoteResult;
export type EntityCommandResponse = EntityRemoteResult;

export type ControlWorkflowSettingsInitialize = WorkflowSettingsInitializeRequest;

export type ControlWorkflowSettingsInitializeResponse = WorkflowSettingsInitializeResult & {
	status: OperatorStatus;
};

export type ControlWorkflowSettingsUpdate = WorkflowSettingsUpdateRequest;

export type ControlWorkflowSettingsUpdateResponse = WorkflowSettingsUpdateResult & {
	status: OperatorStatus;
};

export type MissionGateEvaluate = MissionSelect & {
	intent: GateIntent;
};

export type ControlActionList = {
	context?: OperatorActionQueryContext;
};

export type ControlActionExecute = {
	actionId: string;
	steps?: OperatorActionExecutionStep[];
};

export type ControlActionDescribe = {
	actionId: string;
	steps?: OperatorActionExecutionStep[];
};

export type MissionActionList = MissionSelect & {
	context?: OperatorActionQueryContext;
};

export type MissionActionExecute = MissionSelect & {
	actionId: string;
	steps?: OperatorActionExecutionStep[];
	terminalSessionName?: string;
};

export type TaskSelect = MissionSelect & {
	taskId: string;
};

export type SessionSelect = MissionSelect & {
	sessionId: string;
};

export type SessionConsoleState = SessionSelect;

export type SessionTerminalState = SessionSelect;

export type MissionTerminalStateRequest = MissionSelect;

export type SessionTerminalInput = SessionSelect & {
	data?: string;
	literal?: boolean;
	cols?: number;
	rows?: number;
	respondWithState?: boolean;
};

export type MissionTerminalInput = MissionSelect & {
	data?: string;
	literal?: boolean;
	cols?: number;
	rows?: number;
	respondWithState?: boolean;
};

export type SessionPrompt = SessionSelect & {
	prompt: AgentPrompt;
};

export type SessionCommand = SessionSelect & {
	command: AgentCommand;
};

export type SessionControl = SessionSelect & {
	reason?: string;
};

export type MissionAgentSessionCommandRequest = {
	kind: AgentCommand['type'];
	metadata?: Record<string, MissionAgentPrimitiveValue>;
};

export type ControlRepositoriesList = Record<string, never>;

export type ControlGitHubIssueDetail = {
	issueNumber: number;
};

export type ControlRepositoriesAdd = {
	repositoryPath: string;
};

export type ControlIssuesList = {
	limit?: number;
};

export type AirportClientConnect = {
	paneId: 'tower' | 'briefingRoom' | 'runway';
	label?: string;
	panelProcessId?: string;
	terminalPaneId?: number;
	terminalSessionName?: string;
};

export type AirportClientObserve = {
	focusedPaneId?: 'tower' | 'briefingRoom' | 'runway';
	intentPaneId?: 'tower' | 'briefingRoom' | 'runway';
	repositoryId?: string;
	terminalPaneId?: number;
	terminalSessionName?: string;
};

export type AirportPaneBind = {
	paneId: 'briefingRoom' | 'runway';
	binding: {
		targetKind: 'empty' | 'repository' | 'mission' | 'task' | 'artifact' | 'agentSession';
		targetId?: string;
		mode?: 'view' | 'control';
	};
};

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
		context: ControlWorkflowSettingsUpdate['context'];
	};

export type AddressedNotification = Notification & EntityEventAddress & {
	occurredAt: string;
	missionEntityId?: EntityId;
};

export type EventSubscription = {
	channels?: string[];
};

