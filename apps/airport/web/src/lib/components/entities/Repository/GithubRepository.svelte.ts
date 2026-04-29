import { z } from 'zod/v4';
import { githubVisibleRepositorySchema } from '@flying-pillow/mission-core/entities/GitHubRepository/GitHubRepositorySchema';
import { repositorySnapshotSchema } from '@flying-pillow/mission-core/entities/Repository/RepositorySchema';
import type { RepositorySnapshot } from '@flying-pillow/mission-core/entities/Repository/RepositorySchema';
import { qry } from '../../../../routes/api/entities/remote/query.remote';
import { cmd } from '../../../../routes/api/entities/remote/command.remote';
import type { GitHubVisibleRepositorySummary } from '$lib/components/entities/types';

export class GithubRepository {
	public static async find(): Promise<GitHubVisibleRepositorySummary[]> {
		const repositoriesQuery = qry({
			entity: 'GitHubRepository',
			method: 'find',
			payload: {}
		});
		return z.array(githubVisibleRepositorySchema).parse(
			await repositoriesQuery
		) as GitHubVisibleRepositorySummary[];
	}

	public static async clone(input: {
		githubRepository: string;
		destinationPath: string;
	}): Promise<RepositorySnapshot> {
		return repositorySnapshotSchema.parse(
			await cmd({
				entity: 'GitHubRepository',
				method: 'clone',
				payload: input
			})
		);
	}
}