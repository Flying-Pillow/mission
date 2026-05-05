#!/usr/bin/env node

import { connectDaemon } from '@flying-pillow/mission-core/daemon/client/connectAirportDaemon';
import { Repository } from '@flying-pillow/mission-core/entities/Repository/Repository';

type JsonRpcRequest = {
	jsonrpc?: string;
	id?: string | number | null;
	method?: string;
	params?: unknown;
};

type McpTool = {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		additionalProperties: boolean;
	};
};

const toolDescriptions: Record<string, string> = {
	mission_report_progress: 'Report structured Mission session progress.',
	mission_request_operator_input: 'Ask Mission to surface an operator decision.',
	mission_report_blocked: 'Report that the active Agent session is blocked.',
	mission_report_ready_for_verification: 'Report a ready-for-verification claim.',
	mission_report_completion_claim: 'Report a completion claim.',
	mission_report_failure_claim: 'Report a failure claim.',
	mission_append_session_note: 'Append an agent-authored session note.',
	mission_report_usage: 'Attach structured usage metadata to the active Mission session.',
	mission_entity_command: 'Invoke an allowlisted Mission Entity command for this Agent session.'
};

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
	buffer += chunk;
	while (true) {
		const newlineIndex = buffer.indexOf('\n');
		if (newlineIndex < 0) return;
		const line = buffer.slice(0, newlineIndex).trim();
		buffer = buffer.slice(newlineIndex + 1);
		if (line) void handleLine(line);
	}
});

async function handleLine(line: string): Promise<void> {
	let request: JsonRpcRequest;
	try {
		request = JSON.parse(line) as JsonRpcRequest;
	} catch (error) {
		writeResponse(null, undefined, error);
		return;
	}

	try {
		switch (request.method) {
			case 'initialize':
				writeResponse(request.id, {
					protocolVersion: '2024-11-05',
					capabilities: { tools: {} },
					serverInfo: { name: 'mission', version: '0.1.0-alpha.0' }
				});
				return;
			case 'notifications/initialized':
				return;
			case 'tools/list':
				writeResponse(request.id, { tools: await listTools() });
				return;
			case 'tools/call':
				writeResponse(request.id, await callTool(request.params));
				return;
			default:
				writeResponse(request.id, undefined, new Error(`Unsupported MCP method '${String(request.method)}'.`));
		}
	} catch (error) {
		writeResponse(request.id, undefined, error);
	}
}

async function listTools(): Promise<McpTool[]> {
	const client = await connectDaemon({
		surfacePath: process.env['MISSION_ENTRY_CWD']?.trim() || process.cwd()
	});
	try {
		const result = await client.request<{ tools: string[] }>('mcp.tools.list');
		const allowedTools = readAllowedTools();
		return result.tools
			.filter((toolName) => allowedTools.length === 0 || allowedTools.includes(toolName))
			.map((toolName) => ({
				name: toolName,
				description: toolDescriptions[toolName] ?? `Mission MCP tool ${toolName}.`,
				inputSchema: {
					type: 'object',
					additionalProperties: true
				}
			}));
	} finally {
		client.dispose();
	}
}

async function callTool(params: unknown): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
	const parsed = parseToolCallParams(params);
	const client = await connectDaemon({
		surfacePath: process.env['MISSION_ENTRY_CWD']?.trim() || Repository.resolveRepositoryRoot()
	});
	try {
		const result = await client.request('mcp.tool.invoke', {
			name: parsed.name,
			payload: parsed.arguments
		});
		const accepted = typeof result === 'object' && result !== null && (result as { accepted?: unknown }).accepted === true;
		return {
			content: [{ type: 'text', text: JSON.stringify(result) }],
			...(accepted ? {} : { isError: true })
		};
	} finally {
		client.dispose();
	}
}

function parseToolCallParams(params: unknown): { name: string; arguments: unknown } {
	if (!params || typeof params !== 'object' || Array.isArray(params)) {
		throw new Error('tools/call params must be an object.');
	}
	const record = params as Record<string, unknown>;
	if (typeof record['name'] !== 'string' || !record['name'].trim()) {
		throw new Error('tools/call requires a tool name.');
	}
	return {
		name: record['name'].trim(),
		arguments: record['arguments'] ?? {}
	};
}

function readAllowedTools(): string[] {
	const raw = process.env['MISSION_MCP_ALLOWED_TOOLS'];
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
			: [];
	} catch {
		return [];
	}
}

function writeResponse(id: JsonRpcRequest['id'], result?: unknown, error?: unknown): void {
	if (id === undefined) return;
	const response = error === undefined
		? { jsonrpc: '2.0', id, result }
		: {
			jsonrpc: '2.0',
			id,
			error: {
				code: -32000,
				message: error instanceof Error ? error.message : String(error)
			}
		};
	process.stdout.write(`${JSON.stringify(response)}\n`);
}
