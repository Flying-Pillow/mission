<script lang="ts">
    import { enhance } from "$app/forms";
    import GithubRepositoryList from "$lib/components/entities/Repository/GithubRepositoryList.svelte";
    import type {
        GitHubVisibleRepositorySummary,
    } from "$lib/components/entities/types";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";

    let {
        githubRepositories,
        githubStatusTone,
        githubRepositoriesError,
        controlRoot,
        formState,
        repositoryPath = $bindable(""),
        selectedGitHubRepository = $bindable(""),
    }: {
        githubRepositories: GitHubVisibleRepositorySummary[];
        githubStatusTone: "connected" | "disconnected" | "unknown";
        githubRepositoriesError?: string;
        controlRoot?: string;
        formState?: {
            addRepository?: {
                error?: string;
                success?: boolean;
                repositoryPath?: string;
                githubRepository?: string;
            };
        };
        repositoryPath?: string;
        selectedGitHubRepository?: string;
    } = $props();

    const selectedRepositoryLabel = $derived(
        selectedGitHubRepository || "No GitHub repository selected",
    );
</script>

<section class="rounded-[2rem] border bg-card/70 px-5 py-5 backdrop-blur-sm">
    <div class="space-y-2">
        <h2 class="text-xl font-semibold text-foreground">Add repository</h2>
        <p class="text-sm text-muted-foreground">
            Pair a GitHub repository with the matching local checkout on disk, then let Airport validate the mapping before registration.
        </p>
    </div>

    <form method="POST" action="?/addRepository" use:enhance class="mt-5 grid gap-4">
        <input
            type="hidden"
            name="githubRepository"
            value={selectedGitHubRepository}
        />

        <div class="rounded-2xl border bg-background/60 p-4">
            <p class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Selected GitHub repository
            </p>
            <p class="mt-2 text-sm font-medium text-foreground">
                {selectedRepositoryLabel}
            </p>
            <p class="mt-1 text-sm text-muted-foreground">
                Airport verifies the local checkout path against this remote before completing registration.
            </p>
        </div>

        <div class="grid gap-2">
            <label class="text-sm font-medium text-foreground" for="repositoryPath">
                Local checkout path
            </label>
            <Input
                id="repositoryPath"
                name="repositoryPath"
                placeholder="/Users/you/src/my-repository"
                bind:value={repositoryPath}
            />
            <div class="flex flex-wrap gap-2">
                {#if controlRoot}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onclick={() => {
                            repositoryPath = controlRoot;
                        }}
                    >
                        Use current workspace
                    </Button>
                {/if}
                {#if selectedGitHubRepository}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onclick={() => {
                            selectedGitHubRepository = "";
                        }}
                    >
                        Clear GitHub selection
                    </Button>
                {/if}
            </div>
            <p class="text-sm text-muted-foreground">
                This must be an absolute path on the daemon host to a local Git checkout.
            </p>
        </div>

        {#if formState?.addRepository?.error}
            <p class="text-sm text-rose-600">{formState.addRepository.error}</p>
        {/if}

        {#if formState?.addRepository?.success}
            <p class="text-sm text-emerald-600">
                Repository registered: {formState.addRepository.repositoryPath}
            </p>
        {/if}

        <Button type="submit" class="w-full">Register repository</Button>
    </form>

    <div class="mt-5">
        <GithubRepositoryList
            repositories={githubRepositories}
            selectedRepository={selectedGitHubRepository}
            {githubStatusTone}
            {githubRepositoriesError}
            onSelect={(repository) => {
                selectedGitHubRepository = repository.fullName;
            }}
        />
    </div>
</section>