<script lang="ts">
    import type { GitHubVisibleRepositorySummary } from "$lib/components/entities/types";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import * as Sheet from "$lib/components/ui/sheet/index.js";

    let {
        repository,
        selected = false,
        onSelect = () => {},
    }: {
        repository: GitHubVisibleRepositorySummary;
        selected?: boolean;
        onSelect?: (repository: GitHubVisibleRepositorySummary) => void;
    } = $props();

    let detailsOpen = $state(false);

    function handleSelect(): void {
        onSelect(repository);
    }
</script>

<article
    class={`rounded-2xl border px-4 py-4 transition-colors ${selected ? "border-primary/40 bg-primary/5" : "bg-background/70 hover:bg-background"}`}
>
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
                <h3 class="truncate text-sm font-semibold text-foreground">
                    {repository.fullName}
                </h3>
                <Badge variant={selected ? "default" : "outline"}>
                    {repository.visibility}
                </Badge>
                {#if repository.archived}
                    <Badge variant="secondary">Archived</Badge>
                {/if}
            </div>
            <p class="mt-2 text-sm text-muted-foreground">
                {repository.ownerLogin ?? "GitHub repository"}
            </p>
            <p class="mt-1 font-mono text-xs text-muted-foreground">
                {repository.htmlUrl ?? "URL unavailable"}
            </p>
        </div>

        <div class="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="outline" size="sm" onclick={handleSelect}>
                {selected ? "Selected" : "Use repository"}
            </Button>
            <Sheet.Root bind:open={detailsOpen}>
                <Sheet.Trigger>
                    {#snippet child({ props })}
                        <Button type="button" variant="ghost" size="sm" {...props}>
                            Details
                        </Button>
                    {/snippet}
                </Sheet.Trigger>
                <Sheet.Content side="right" class="w-full sm:max-w-xl">
                    <Sheet.Header class="gap-3 border-b bg-card/60">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">GitHub</Badge>
                            <Badge variant={repository.visibility === "private" ? "secondary" : "outline"}>
                                {repository.visibility}
                            </Badge>
                            {#if repository.archived}
                                <Badge variant="secondary">Archived</Badge>
                            {/if}
                        </div>
                        <Sheet.Title>{repository.fullName}</Sheet.Title>
                        <Sheet.Description>
                            Review the repository metadata, then use it as the source for Airport registration.
                        </Sheet.Description>
                    </Sheet.Header>

                    <div class="grid gap-4 p-6">
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div class="rounded-2xl border bg-background/80 p-4">
                                <p class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Owner
                                </p>
                                <p class="mt-2 text-sm font-medium text-foreground">
                                    {repository.ownerLogin ?? "Unavailable"}
                                </p>
                            </div>
                            <div class="rounded-2xl border bg-background/80 p-4">
                                <p class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Status
                                </p>
                                <p class="mt-2 text-sm font-medium text-foreground">
                                    {repository.archived ? "Archived repository" : "Active repository"}
                                </p>
                            </div>
                        </div>

                        <div class="rounded-3xl border bg-muted/40 p-4">
                            <p class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Full name
                            </p>
                            <p class="mt-2 text-base font-semibold text-foreground">
                                {repository.fullName}
                            </p>
                            <Separator class="my-4" />
                            <p class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Remote URL
                            </p>
                            <p class="mt-2 break-all font-mono text-xs text-muted-foreground">
                                {repository.htmlUrl ?? "URL unavailable"}
                            </p>
                        </div>
                    </div>

                    <Sheet.Footer class="border-t bg-card/40 sm:flex-row sm:justify-between">
                        {#if repository.htmlUrl}
                            <Button
                                href={repository.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                variant="outline"
                            >
                                Open on GitHub
                            </Button>
                        {:else}
                            <span class="text-sm text-muted-foreground">
                                GitHub URL is not available for this repository.
                            </span>
                        {/if}
                        <div class="flex flex-wrap gap-2">
                            <Sheet.Close>
                                {#snippet child({ props })}
                                    <Button type="button" variant="ghost" {...props}>
                                        Close
                                    </Button>
                                {/snippet}
                            </Sheet.Close>
                            <Button
                                type="button"
                                onclick={() => {
                                    handleSelect();
                                    detailsOpen = false;
                                }}
                            >
                                Use for registration
                            </Button>
                        </div>
                    </Sheet.Footer>
                </Sheet.Content>
            </Sheet.Root>
        </div>
    </div>
</article>