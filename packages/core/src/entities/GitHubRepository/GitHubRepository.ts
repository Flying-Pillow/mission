import { getMissionGitHubCliBinary } from '../../lib/config.js';
import { Repository } from '../Repository/Repository.js';
import {
	createRepositoryPlatformAdapter,
	type RepositoryPlatformAdapter
} from '../Repository/PlatformAdapter.js';
import {
	type GitHubRepositoryClonePayload,
	type GitHubRepositoryFindPayload,
	gitHubRepositoryClonePayloadSchema,
	gitHubRepositoryFindPayloadSchema
} from './GitHubRepositorySchema.js';

export class GitHubRepository {
	public static async find(
		input: GitHubRepositoryFindPayload = {},
		context?: { authToken?: string; surfacePath?: string }
	) {
		gitHubRepositoryFindPayloadSchema.parse(input);
		const adapter = this.createPlatformAdapter(context);
		return await adapter.listVisibleRepositories();
	}

	public static async clone(
		input: GitHubRepositoryClonePayload,
		context?: { authToken?: string; surfacePath?: string }
	) {
		const payload = gitHubRepositoryClonePayloadSchema.parse(input);
		const adapter = this.createPlatformAdapter(context);
		const repositoryRootPath = await adapter.cloneRepository({
			repository: payload.githubRepository,
			destinationPath: payload.destinationPath
		});

		return Repository.add(
			{ repositoryPath: repositoryRootPath },
			context?.surfacePath
				? {
					surfacePath: context.surfacePath,
					...(context.authToken ? { authToken: context.authToken } : {})
				}
				: undefined
		);
	}

	private static createPlatformAdapter(context?: {
		authToken?: string;
		surfacePath?: string;
	}): RepositoryPlatformAdapter {
		const ghBinary = getMissionGitHubCliBinary();
		return createRepositoryPlatformAdapter({
			platform: 'github',
			workspaceRoot: context?.surfacePath?.trim() || process.cwd(),
			...(context?.authToken ? { authToken: context.authToken } : {}),
			...(ghBinary ? { ghBinary } : {})
		});
	}
}