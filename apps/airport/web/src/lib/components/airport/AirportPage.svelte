<script lang="ts">
    import { onMount } from "svelte";
    import { getAppContext } from "$lib/client/context/app-context.svelte";
    import RepositoryList from "$lib/components/entities/Repository/RepositoryList.svelte";

    const appContext = getAppContext();

    onMount(() => {
        appContext.setActiveMission(undefined);
        appContext.setActiveMissionOutline(undefined);
        appContext.setActiveMissionSelectedNodeId(undefined);

        void appContext.application.loadRepositories().catch(() => undefined);
        void appContext.application
            .loadGitHubRepositories()
            .catch(() => undefined);
    });
</script>

<div class="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
    <div class="mt-4 min-h-0 flex-1 overflow-hidden">
        <RepositoryList />
    </div>
</div>
