import { describe, expect, it } from 'vitest';
import { ProviderOutputSignalParser } from './ProviderOutputSignalParser.js';

describe('ProviderOutputSignalParser', () => {
	it('converts provider messages and usage into provider-structured Mission signals', () => {
		const parser = new ProviderOutputSignalParser();

		expect(parser.parse({
			kind: 'message',
			channel: 'agent',
			text: 'Still working.'
		})).toEqual([{
			signal: {
				type: 'message',
				channel: 'agent',
				text: 'Still working.',
				source: 'provider-structured',
				confidence: 'high'
			}
		}]);

		expect(parser.parse({
			kind: 'usage',
			payload: {
				inputTokens: 12,
				outputTokens: 8
			}
		})).toEqual([{
			signal: {
				type: 'usage',
				payload: {
					inputTokens: 12,
					outputTokens: 8
				},
				source: 'provider-structured',
				confidence: 'high'
			}
		}]);
	});

	it('converts provider session and tool-call signals into diagnostics only', () => {
		const parser = new ProviderOutputSignalParser();

		expect(parser.parse({
			kind: 'signal',
			signal: {
				type: 'provider-session',
				providerName: 'claude-code',
				sessionId: 'claude-session-42',
				source: 'provider-structured',
				confidence: 'high'
			}
		})).toEqual([{
			dedupeKey: 'provider-session:claude-code:claude-session-42',
			signal: {
				type: 'diagnostic',
				code: 'provider-session',
				summary: "Provider 'claude-code' reported session 'claude-session-42'.",
				payload: {
					providerName: 'claude-code',
					sessionId: 'claude-session-42'
				},
				source: 'provider-structured',
				confidence: 'high'
			}
		}]);

		expect(parser.parse({
			kind: 'signal',
			signal: {
				type: 'tool-call',
				toolName: 'Bash',
				args: 'pnpm test',
				source: 'provider-structured',
				confidence: 'medium'
			}
		})).toEqual([{
			dedupeKey: 'tool-call:Bash:pnpm test',
			signal: {
				type: 'diagnostic',
				code: 'tool-call',
				summary: "Provider invoked tool 'Bash'.",
				detail: 'pnpm test',
				payload: {
					toolName: 'Bash',
					args: 'pnpm test'
				},
				source: 'provider-structured',
				confidence: 'medium'
			}
		}]);
	});
});
