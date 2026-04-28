<script lang="ts">
    import { onMount } from "svelte";
    import AirportHomeStatus from "$lib/components/airport/airport-status.svelte";
    import RepositoryList from "$lib/components/entities/Repository/RepositoryList.svelte";
    import { getAppContext } from "$lib/client/context/app-context.svelte";
    import { Repository } from "$lib/components/entities/Repository/Repository.svelte.js";

    const appContext = getAppContext();
    let repositoriesLoading = $state(true);
    let repositoriesError = $state<string | undefined>();

    onMount(() => {
        appContext.setActiveMission(undefined);
        appContext.setActiveMissionOutline(undefined);
        appContext.setActiveMissionSelectedNodeId(undefined);
        void loadRepositories();
    });

    async function loadRepositories(): Promise<void> {
        repositoriesLoading = true;
        repositoriesError = undefined;
        try {
            await Repository.find();
        } catch (error) {
            repositoriesError =
                error instanceof Error ? error.message : String(error);
        } finally {
            repositoriesLoading = false;
        }
    }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4 bg-muted/20 px-4 pb-4 pt-3">
    <AirportHomeStatus />

    {#if repositoriesError}
        <section class="rounded-lg border bg-card px-5 py-4 shadow-sm">
            <h2 class="text-lg font-semibold text-foreground">Repositories</h2>
            <p class="mt-3 text-sm text-rose-600">{repositoriesError}</p>
        </section>
    {:else if repositoriesLoading}
        <section
            class="rounded-lg border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm"
        >
            Loading repositories...
        </section>
    {:else}
        <RepositoryList
            mode="repositories"
            heading="Repositories registered"
            description="Repositories returned by the daemon Repository entity."
        />
    {/if}
</div>
