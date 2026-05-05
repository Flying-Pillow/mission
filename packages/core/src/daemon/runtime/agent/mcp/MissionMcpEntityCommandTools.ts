import { z } from 'zod/v4';
import {
	missionMcpSignalEnvelopeSchema,
	type MissionMcpSignalEnvelope
} from './MissionMcpSignalTools.js';

export const missionMcpEntityCommandToolName = 'mission_entity_command' as const;

export type MissionMcpEntityCommandToolName = typeof missionMcpEntityCommandToolName;

export type MissionMcpAllowedEntityCommand = {
	entity: string;
	method: string;
	commandId?: string | undefined;
};

export type MissionMcpEntityCommandEnvelope = MissionMcpSignalEnvelope;

export type MissionMcpEntityCommandInvocation = {
	entity: string;
	method: string;
	payload?: unknown;
};

export type MissionMcpEntityCommandAcknowledgement =
	| {
		accepted: true;
		outcome: 'entity-command';
		result: unknown;
	}
	| {
		accepted: false;
		outcome: 'rejected';
		reason: string;
	};

export type MissionMcpEntityCommandExecutor = (
	input: MissionMcpEntityCommandInvocation
) => Promise<unknown>;

export type MissionMcpValidatedEntityCommandToolCall = {
	name: MissionMcpEntityCommandToolName;
	envelope: MissionMcpEntityCommandEnvelope;
	invocation: MissionMcpEntityCommandInvocation;
	commandId?: string;
};

export const missionMcpAllowedEntityCommandSchema = z.object({
	entity: z.string().trim().min(1),
	method: z.string().trim().min(1),
	commandId: z.string().trim().min(1).optional()
}).strict();

const missionMcpEntityCommandToolCallSchema = missionMcpSignalEnvelopeSchema.extend({
	entity: z.string().trim().min(1),
	method: z.string().trim().min(1),
	payload: z.unknown().optional()
}).strict();

const missionMcpEntityCommandInvocationSchema = z.object({
	entity: z.string().trim().min(1),
	method: z.string().trim().min(1),
	payload: z.unknown().optional()
}).strict();

export function parseMissionMcpEntityCommandToolCall(
	input: unknown
): { success: true; value: MissionMcpValidatedEntityCommandToolCall } | { success: false; reason: string } {
	const parsed = missionMcpEntityCommandToolCallSchema.safeParse(input);
	if (!parsed.success) {
		return {
			success: false,
			reason: `Invalid payload for MCP tool '${missionMcpEntityCommandToolName}': ${formatZodIssues(parsed.error.issues)}`
		};
	}

	const invocation = missionMcpEntityCommandInvocationSchema.safeParse({
		entity: parsed.data.entity,
		method: parsed.data.method,
		...(parsed.data.payload === undefined ? {} : { payload: parsed.data.payload })
	});
	if (!invocation.success) {
		return {
			success: false,
			reason: `Invalid Entity command invocation for MCP tool '${missionMcpEntityCommandToolName}': ${formatZodIssues(invocation.error.issues)}`
		};
	}

	return {
		success: true,
		value: {
			name: missionMcpEntityCommandToolName,
			envelope: {
				missionId: parsed.data.missionId,
				taskId: parsed.data.taskId,
				agentSessionId: parsed.data.agentSessionId,
				eventId: parsed.data.eventId
			},
			invocation: invocation.data,
			...extractEntityCommandId(invocation.data.payload)
		}
	};
}

function extractEntityCommandId(payload: unknown): { commandId?: string } {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return {};
	}
	const commandId = (payload as Record<string, unknown>)['commandId'];
	return typeof commandId === 'string' && commandId.trim()
		? { commandId: commandId.trim() }
		: {};
}

function formatZodIssues(issues: z.core.$ZodIssue[]): string {
	return issues.map((issue) => {
		const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
		return `${path}${issue.message}`;
	}).join('; ');
}
