import { spawn } from 'node:child_process';
import type { MissionBrief, MissionType, TrackedIssueSummary } from '../types.js';

type GitHubIssuePayload = {
	number: number;
	title: string;
	body?: string;
	url?: string;
	labels?: Array<{ name?: string }>;
	updatedAt?: string;
	assignees?: Array<{ login?: string }>;
};

function mapLabelsToMissionType(labels: string[]): MissionType | undefined {
	const normalizedLabels = labels.map((label) => label.trim().toLowerCase());
	if (normalizedLabels.includes('bug')) {
		return 'fix';
	}
	if (normalizedLabels.includes('enhancement')) {
		return 'feat';
	}
	if (normalizedLabels.includes('documentation')) {
		return 'docs';
	}
	return undefined;
}

export class GitHubPlatformAdapter {
	public constructor(
		private readonly repoRoot: string,
		private readonly repository?: string
	) {}

	public async fetchIssue(issueId: string): Promise<MissionBrief> {
		const payload = await this.runJsonProcess<GitHubIssuePayload>([
			'issue',
			'view',
			issueId,
			'--json',
			'number,title,body,url,labels',
			...(this.repository ? ['--repo', this.repository] : [])
		]);

		const labels = (payload.labels ?? [])
			.map((label) => String(label.name ?? '').trim())
			.filter(Boolean);
		const type = mapLabelsToMissionType(labels) ?? 'task';

		return {
			issueId: payload.number,
			title: payload.title,
			body: payload.body?.trim() || 'Issue body not captured yet.',
			type,
			...(payload.url ? { url: payload.url } : {}),
			...(labels.length > 0 ? { labels } : {})
		} satisfies MissionBrief;
	}

	public async listOpenIssues(limit = 50): Promise<TrackedIssueSummary[]> {
		const payload = await this.runJsonProcess<GitHubIssuePayload[]>([
			'issue',
			'list',
			'--state',
			'open',
			'--limit',
			String(limit),
			'--json',
			'number,title,labels,assignees,url,updatedAt',
			...(this.repository ? ['--repo', this.repository] : [])
		]);

		return payload.map((issue) => ({
			number: issue.number,
			title: issue.title,
			url: issue.url ?? '',
			...(issue.updatedAt ? { updatedAt: issue.updatedAt } : {}),
			labels: (issue.labels ?? [])
				.map((label) => String(label.name ?? '').trim())
				.filter(Boolean),
			assignees: (issue.assignees ?? [])
				.map((assignee) => String(assignee.login ?? '').trim())
				.filter(Boolean)
		}));
	}

	private async runJsonProcess<T>(args: string[]): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const child = spawn('gh', args, {
				cwd: this.repoRoot,
				env: process.env,
				stdio: ['ignore', 'pipe', 'pipe']
			});

			let stdout = '';
			let stderr = '';

			child.stdout.on('data', (chunk: Buffer) => {
				stdout += chunk.toString();
			});

			child.stderr.on('data', (chunk: Buffer) => {
				stderr += chunk.toString();
			});

			child.once('error', (error) => {
				reject(error);
			});

			child.once('close', (code) => {
				if (code !== 0) {
					reject(new Error(stderr.trim() || `gh exited with code ${String(code ?? 'unknown')}.`));
					return;
				}

				try {
					resolve(JSON.parse(stdout) as T);
				} catch (error) {
					reject(
						new Error(
							`gh returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
						)
					);
				}
			});
		});
	}
}