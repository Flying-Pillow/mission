import { z } from 'zod/v4';
import type {
	MissionMcpSignalEnvelope,
	MissionMcpSignalToolName
} from './MissionMcpSignalTools.js';
import {
	missionMcpSignalEnvelopeSchema,
	missionMcpSignalToolNameSchema
} from './MissionMcpSignalTools.js';
import {
	missionMcpAllowedEntityCommandSchema,
	missionMcpEntityCommandToolName,
	type MissionMcpAllowedEntityCommand,
	type MissionMcpEntityCommandEnvelope,
	type MissionMcpEntityCommandToolName
} from './MissionMcpEntityCommandTools.js';

export type MissionMcpToolName = MissionMcpSignalToolName | MissionMcpEntityCommandToolName;

export type MissionMcpSessionRegistration = {
	missionId: string;
	taskId: string;
	agentSessionId: string;
	allowedTools: MissionMcpToolName[];
	allowedEntityCommands?: MissionMcpAllowedEntityCommand[];
};

type MissionMcpSessionRegistryEntry = {
	registration: MissionMcpSessionRegistration;
	seenEventIds: Set<string>;
};

const missionMcpSessionRegistrationSchema = missionMcpSignalEnvelopeSchema.pick({
	missionId: true,
	taskId: true,
	agentSessionId: true
}).extend({
	allowedTools: z.array(z.union([
		missionMcpSignalToolNameSchema,
		z.literal(missionMcpEntityCommandToolName)
	])),
	allowedEntityCommands: z.array(missionMcpAllowedEntityCommandSchema).optional()
}).strict();

export class MissionMcpSessionRegistry {
	private readonly registrations = new Map<string, MissionMcpSessionRegistryEntry>();

	public registerSession(input: MissionMcpSessionRegistration): MissionMcpSessionRegistration {
		const registration = parseRegistration(input);
		this.registrations.set(registration.agentSessionId, {
			registration,
			seenEventIds: new Set<string>()
		});
		return cloneRegistration(registration);
	}

	public unregisterSession(agentSessionId: string): void {
		this.registrations.delete(agentSessionId);
	}

	public clear(): void {
		this.registrations.clear();
	}

	public getRegisteredSessionCount(): number {
		return this.registrations.size;
	}

	public authorizeTool(input: {
		envelope: MissionMcpSignalEnvelope;
		toolName: MissionMcpToolName;
	}): { ok: true; registration: MissionMcpSessionRegistration } | { ok: false; reason: string } {
		const entry = this.registrations.get(input.envelope.agentSessionId);
		if (!entry) {
			return {
				ok: false,
				reason: `Unknown Mission MCP session '${input.envelope.agentSessionId}'.`
			};
		}
		if (entry.registration.missionId !== input.envelope.missionId) {
			return {
				ok: false,
				reason: `Mission MCP envelope mission '${input.envelope.missionId}' did not match registered mission '${entry.registration.missionId}'.`
			};
		}
		if (entry.registration.taskId !== input.envelope.taskId) {
			return {
				ok: false,
				reason: `Mission MCP envelope task '${input.envelope.taskId}' did not match registered task '${entry.registration.taskId}'.`
			};
		}
		if (!entry.registration.allowedTools.includes(input.toolName)) {
			return {
				ok: false,
				reason: `Mission MCP tool '${input.toolName}' is not allowed for session '${input.envelope.agentSessionId}'.`
			};
		}
		if (entry.seenEventIds.has(input.envelope.eventId)) {
			return {
				ok: false,
				reason: `Mission MCP event '${input.envelope.eventId}' was already processed for session '${input.envelope.agentSessionId}'.`
			};
		}
		return {
			ok: true,
			registration: cloneRegistration(entry.registration)
		};
	}

	public authorizeEntityCommand(input: {
		envelope: MissionMcpEntityCommandEnvelope;
		toolName: MissionMcpEntityCommandToolName;
		entity: string;
		method: string;
		commandId?: string;
	}): { ok: true; registration: MissionMcpSessionRegistration } | { ok: false; reason: string } {
		const toolAuthorization = this.authorizeTool(input);
		if (!toolAuthorization.ok) {
			return toolAuthorization;
		}
		if (!toolAuthorization.registration.allowedEntityCommands?.some((allowedCommand) =>
			matchesAllowedEntityCommand(allowedCommand, input)
		)) {
			return {
				ok: false,
				reason: `Entity command '${input.entity}.${input.method}${input.commandId ? `:${input.commandId}` : ''}' is not allowed for session '${input.envelope.agentSessionId}'.`
			};
		}
		return toolAuthorization;
	}

	public rememberEvent(agentSessionId: string, eventId: string): void {
		const entry = this.registrations.get(agentSessionId);
		if (!entry) {
			return;
		}
		entry.seenEventIds.add(eventId);
	}
}

function parseRegistration(input: MissionMcpSessionRegistration): MissionMcpSessionRegistration {
	const parsed = missionMcpSessionRegistrationSchema.safeParse(input);
	if (!parsed.success) {
		throw new Error(`Invalid Mission MCP session registration: ${formatZodIssues(parsed.error.issues)}`);
	}

	return {
		missionId: parsed.data.missionId,
		taskId: parsed.data.taskId,
		agentSessionId: parsed.data.agentSessionId,
		allowedTools: [...new Set(parsed.data.allowedTools)],
		...(parsed.data.allowedEntityCommands ? {
			allowedEntityCommands: dedupeAllowedEntityCommands(parsed.data.allowedEntityCommands)
		} : {})
	};
}

function cloneRegistration(input: MissionMcpSessionRegistration): MissionMcpSessionRegistration {
	return {
		missionId: input.missionId,
		taskId: input.taskId,
		agentSessionId: input.agentSessionId,
		allowedTools: [...input.allowedTools],
		...(input.allowedEntityCommands ? {
			allowedEntityCommands: input.allowedEntityCommands.map((command) => ({ ...command }))
		} : {})
	};
}

function matchesAllowedEntityCommand(
	allowedCommand: MissionMcpAllowedEntityCommand,
	input: { entity: string; method: string; commandId?: string }
): boolean {
	return allowedCommand.entity === input.entity
		&& allowedCommand.method === input.method
		&& (!allowedCommand.commandId || allowedCommand.commandId === input.commandId);
}

function dedupeAllowedEntityCommands(
	commands: MissionMcpAllowedEntityCommand[]
): MissionMcpAllowedEntityCommand[] {
	const seen = new Set<string>();
	const deduped: MissionMcpAllowedEntityCommand[] = [];
	for (const command of commands) {
		const key = `${command.entity}\u0000${command.method}\u0000${command.commandId ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push({ ...command });
	}
	return deduped;
}

function formatZodIssues(issues: z.core.$ZodIssue[]): string {
	return issues.map((issue) => {
		const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
		return `${path}${issue.message}`;
	}).join('; ');
}
