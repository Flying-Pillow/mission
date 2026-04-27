<script lang="ts">
    import { onMount } from "svelte";
    import AirportHomeStatus from "$lib/components/airport/airport-status.svelte";
    import { getAppContext } from "$lib/client/context/app-context.svelte";

    const appContext = getAppContext();

    onMount(() => {
        appContext.setActiveMission(undefined);
        appContext.setActiveMissionOutline(undefined);
        appContext.setActiveMissionSelectedNodeId(undefined);
    });
</script>

<div class="flex min-h-0 flex-1 flex-col bg-muted/20 px-4 pb-4 pt-3">
    <AirportHomeStatus />
</div>
