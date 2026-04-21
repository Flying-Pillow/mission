<script lang="ts">
    import type {
        GitHubVisibleRepositorySummary,
    } from "$lib/components/entities/types";
    import GithubRepository from "$lib/components/entities/Repository/GithubRepository.svelte";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

    let {
        repositories,
        selectedRepository = "",
        githubStatusTone,
        githubRepositoriesError,
        onSelect = () => {},
    }: {
        repositories: GitHubVisibleRepositorySummary[];
        selectedRepository?: string;
        githubStatusTone: "connected" | "disconnected" | "unknown";
        githubRepositoriesError?: string;
        onSelect?: (repository: GitHubVisibleRepositorySummary) => void;
    } = $props();

    const repositoryCountLabel = $derived(
        repositories.length === 1
            ? "1 GitHub repository"
            : `${repositories.length} GitHub repositories`,
    );

    const emptyMessage = $derived(
        githubStatusTone === "connected"
            ? "No GitHub repositories were returned for this account yet. You can still register a local checkout directly."
            : "Connect GitHub to browse your user and organization repositories here.",
    );
</script>

<section class="rounded-2xl border bg-background/50 p-4">
    <div class="flex items-center justify-between gap-4">
        <div>
            <h3 class="text-base font-semibold text-foreground">
                GitHub repository browser
            </h3>
            <p class="mt-1 text-sm text-muted-foreground">
                Browse accessible repositories, inspect the details, and set one as the target for registration.
            </p>
        </div>
        <Badge variant="secondary">{repositoryCountLabel}</Badge>
    </div>

    {#if githubRepositoriesError}
        <p class="mt-3 text-sm text-rose-600">{githubRepositoriesError}</p>
    {/if}

    <ScrollArea class="mt-4 max-h-[28rem] pr-3">
        <div class="grid gap-3">
            {#if repositories.length === 0}
                <div
                    class="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-sm text-muted-foreground"
                >
                    {emptyMessage}
                </div>
            {:else}
                {#each repositories as repository (repository.fullName)}
                    <GithubRepository
                        {repository}
                        selected={selectedRepository === repository.fullName}
                        {onSelect}
                    />
                {/each}
            {/if}
        </div>
    </ScrollArea>
</section>