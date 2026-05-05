import { randomUUID } from 'node:crypto';
import type { AgentSessionSignalPort } from '../signals/AgentSessionSignalPort.js';
import {
	listMissionMcpSignalToolDefinitions,
	missionMcpSignalToolNames,
	parseMissionMcpSignalToolCall,
	type MissionMcpSignalAcknowledgement,
	type MissionMcpSignalToolName
} from './MissionMcpSignalTools.js';
import {
	MissionMcpSessionRegistry,
	type MissionMcpSessionRegistration
} from './MissionMcpSessionRegistry.js';
import {
	missionMcpEntityCommandToolName,
	parseMissionMcpEntityCommandToolCall,
	type MissionMcpEntityCommandAcknowledgement,
	type MissionMcpEntityCommandExecutor,
	type MissionMcpEntityCommandToolName,
	type MissionMcpValidatedEntityCommandToolCall
} from './MissionMcpEntityCommandTools.js';

export type MissionMcpSignalServerHandle = {
	serverId: string;
	endpoint: string;
	localOnly: true;
	transport: 'in-memory-local';
	toolNames: readonly MissionMcpToolName[];
	healthCheck(): Promise<MissionMcpSignalServerHealth>;
	invokeTool(name: MissionMcpToolName, payload: unknown): Promise<MissionMcpToolAcknowledgement>;
};

export type MissionMcpSignalServerHealth = {
	serverId: string;
	endpoint: string;
	running: boolean;
	localOnly: true;
	transport: 'in-memory-local';
	registeredSessionCount: number;
};

export type MissionMcpToolName = MissionMcpSignalToolName | MissionMcpEntityCommandToolName;

export type MissionMcpToolAcknowledgement =
	| MissionMcpSignalAcknowledgement
	| MissionMcpEntityCommandAcknowledgement;

export type MissionMcpRegisteredSession = MissionMcpSessionRegistration & {
	endpoint: string;
	localOnly: true;
	transport: 'in-memory-local';
};

export class MissionMcpSignalServer {
	private readonly signalPort: AgentSessionSignalPort;

	private readonly sessionRegistry: MissionMcpSessionRegistry;

	private readonly executeEntityCommand: MissionMcpEntityCommandExecutor | undefined;

	private handle: MissionMcpSignalServerHandle | undefined;

	public constructor(options: {
		signalPort: AgentSessionSignalPort;
		sessionRegistry?: MissionMcpSessionRegistry;
		executeEntityCommand?: MissionMcpEntityCommandExecutor;
	}) {
		this.signalPort = options.signalPort;
		this.sessionRegistry = options.sessionRegistry ?? new MissionMcpSessionRegistry();
		this.executeEntityCommand = options.executeEntityCommand;
	}

	public async start(): Promise<MissionMcpSignalServerHandle> {
		if (this.handle) {
			return this.handle;
		}

		const serverId = randomUUID();
		this.handle = {
			serverId,
			endpoint: `mission-local://mcp-signal/${serverId}`,
			localOnly: true,
			transport: 'in-memory-local',
			toolNames: [...missionMcpSignalToolNames, missionMcpEntityCommandToolName],
			healthCheck: async () => this.healthCheck(),
			invokeTool: async (name, payload) => this.invokeTool(name, payload)
		};
		return this.handle;
	}

	public async registerSession(
		input: MissionMcpSessionRegistration
	): Promise<MissionMcpRegisteredSession> {
		const handle = this.requireHandle();
		const registration = this.sessionRegistry.registerSession(input);
		return {
			...registration,
			endpoint: handle.endpoint,
			localOnly: true,
			transport: 'in-memory-local'
		};
	}

	public async unregisterSession(agentSessionId: string): Promise<void> {
		this.sessionRegistry.unregisterSession(agentSessionId);
	}

	public async stop(): Promise<void> {
		this.sessionRegistry.clear();
		this.handle = undefined;
	}

	public async healthCheck(): Promise<MissionMcpSignalServerHealth> {
		const handle = this.requireHandle();
		return {
			serverId: handle.serverId,
			endpoint: handle.endpoint,
			running: true,
			localOnly: true,
			transport: 'in-memory-local',
			registeredSessionCount: this.sessionRegistry.getRegisteredSessionCount()
		};
	}

	private async invokeTool(
		name: MissionMcpToolName,
		payload: unknown
	): Promise<MissionMcpToolAcknowledgement> {
		if (!this.handle) {
			return rejectAcknowledgement('Mission MCP signal server is not running.');
		}
		if (name === missionMcpEntityCommandToolName) {
			return this.invokeEntityCommandTool(payload);
		}
		if (!listMissionMcpSignalToolDefinitions().some((definition) => definition.name === name)) {
			return rejectAcknowledgement(`Unknown Mission MCP tool '${name}'.`);
		}

		const parsed = parseMissionMcpSignalToolCall(name, payload);
		if (!parsed.success) {
			return rejectAcknowledgement(parsed.reason);
		}

		const authorization = this.sessionRegistry.authorizeTool({
			envelope: parsed.value.envelope,
			toolName: name
		});
		if (!authorization.ok) {
			return rejectAcknowledgement(authorization.reason);
		}

		const acknowledgement = await this.signalPort.reportSignal({
			scope: {
				missionId: parsed.value.envelope.missionId,
				taskId: parsed.value.envelope.taskId,
				agentSessionId: parsed.value.envelope.agentSessionId
			},
			eventId: parsed.value.envelope.eventId,
			signal: parsed.value.signal
		});
		if (acknowledgement.accepted) {
			this.sessionRegistry.rememberEvent(
				parsed.value.envelope.agentSessionId,
				parsed.value.envelope.eventId
			);
		}
		return acknowledgement;
	}

	private async invokeEntityCommandTool(payload: unknown): Promise<MissionMcpEntityCommandAcknowledgement> {
		const parsed = parseMissionMcpEntityCommandToolCall(payload);
		if (!parsed.success) {
			return rejectEntityCommandAcknowledgement(parsed.reason);
		}
		if (!this.executeEntityCommand) {
			return rejectEntityCommandAcknowledgement('Mission MCP entity command execution is not configured.');
		}

		const authorization = this.sessionRegistry.authorizeEntityCommand({
			envelope: parsed.value.envelope,
			toolName: missionMcpEntityCommandToolName,
			entity: parsed.value.invocation.entity,
			method: parsed.value.invocation.method,
			...(parsed.value.commandId ? { commandId: parsed.value.commandId } : {})
		});
		if (!authorization.ok) {
			return rejectEntityCommandAcknowledgement(authorization.reason);
		}
		const scopeRejection = validateEntityCommandScope(parsed.value);
		if (scopeRejection) {
			return rejectEntityCommandAcknowledgement(scopeRejection);
		}

		try {
			const result = await this.executeEntityCommand(parsed.value.invocation);
			this.sessionRegistry.rememberEvent(
				parsed.value.envelope.agentSessionId,
				parsed.value.envelope.eventId
			);
			return {
				accepted: true,
				outcome: 'entity-command',
				result
			};
		} catch (error) {
			return rejectEntityCommandAcknowledgement(error instanceof Error ? error.message : String(error));
		}
	}

	private requireHandle(): MissionMcpSignalServerHandle {
		if (!this.handle) {
			throw new Error('Mission MCP signal server must be started before session registration.');
		}
		return this.handle;
	}
}

function validateEntityCommandScope(input: MissionMcpValidatedEntityCommandToolCall): string | undefined {
	const payload = input.invocation.payload;
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return undefined;
	}
	const record = payload as Record<string, unknown>;
	if (typeof record['missionId'] === 'string' && record['missionId'] !== input.envelope.missionId) {
		return `Entity command mission '${record['missionId']}' did not match MCP envelope mission '${input.envelope.missionId}'.`;
	}
	if (input.invocation.entity === 'Task' && typeof record['taskId'] === 'string' && record['taskId'] !== input.envelope.taskId) {
		return `Task command target '${record['taskId']}' did not match MCP envelope task '${input.envelope.taskId}'.`;
	}
	if (input.invocation.entity === 'AgentSession' && typeof record['sessionId'] === 'string' && record['sessionId'] !== input.envelope.agentSessionId) {
		return `AgentSession command target '${record['sessionId']}' did not match MCP envelope session '${input.envelope.agentSessionId}'.`;
	}
	return undefined;
}

function rejectAcknowledgement(reason: string): MissionMcpSignalAcknowledgement {
	return {
		accepted: false,
		outcome: 'rejected',
		reason
	};
}

function rejectEntityCommandAcknowledgement(reason: string): MissionMcpEntityCommandAcknowledgement {
	return {
		accepted: false,
		outcome: 'rejected',
		reason
	};
}
