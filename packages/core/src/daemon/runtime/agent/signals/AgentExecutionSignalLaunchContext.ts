import type { AgentExecutionProtocolDescriptorType } from '../../../../entities/AgentExecution/AgentExecutionSchema.js';

export type AgentExecutionSignalLaunchContext = {
    launchEnv: Record<string, string>;
    sessionInstructions: string;
};

export function buildAgentExecutionSignalLaunchContext(input: {
    missionId: string;
    taskId: string;
    agentExecutionId: string;
    protocolDescriptor: AgentExecutionProtocolDescriptorType;
}): AgentExecutionSignalLaunchContext {
    const markerPrefix = input.protocolDescriptor.owner.markerPrefix;
    const markerExample = `${markerPrefix}${JSON.stringify({
        version: 1,
        missionId: input.missionId,
        taskId: input.taskId,
        agentExecutionId: input.agentExecutionId,
        eventId: 'replace-with-unique-event-id',
        signal: {
            type: 'progress',
            summary: 'Working on the next implementation step.'
        }
    })}`;

    return {
        launchEnv: {},
        sessionInstructions: [
            'Agent execution structured interaction is mandatory for this execution.',
            `- The owning Entity is ${input.protocolDescriptor.owner.entity} '${input.protocolDescriptor.owner.entityId}'.`,
            '- Mission observes your stdout and parses strict one-line owner-addressed signal markers deterministically.',
            `- Every structured state signal must start at the beginning of a stdout line with ${markerPrefix} followed immediately by strict JSON.`,
            '- Do not use prose as a substitute for structured state signals; prose is only explanatory output.',
            '- Use a fresh eventId for every distinct signal. Reusing an eventId is treated as a duplicate.',
            '- Keep every marker on one line. Malformed, oversized, stderr, or wrong-scope markers are rejected or recorded only as diagnostics.',
            '- Completion and ready-for-verification markers are claims, not deterministic verification authority.',
            'Use these exact scope fields in every marker:',
            `- missionId: ${input.missionId}`,
            `- taskId: ${input.taskId}`,
            `- agentExecutionId: ${input.agentExecutionId}`,
            'Supported signal payloads:',
            ...input.protocolDescriptor.signals.map((signal) => `- ${signal.type}: ${signal.label} (${signal.policy})`),
            'Example marker:',
            markerExample
        ].join('\n')
    };
}