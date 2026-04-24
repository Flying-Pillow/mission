<script lang="ts">
    import AirportHomeAddRepository from "$lib/components/airport/home/airport-home-add-repository.svelte";
    import AirportHomeStatus from "$lib/components/airport/home/airport-home-status.svelte";
    import { getAppContext } from "$lib/client/context/app-context.svelte";
    import RepositoryList from "$lib/components/entities/Repository/RepositoryList.svelte";
    import { getAirportRouteData } from "../../../routes/api/airport/airport.remote";

    const appContext = getAppContext();
    const airportRouteDataQuery = getAirportRouteData({});
    const airportRouteData = $derived(airportRouteDataQuery.current);
    let airportRouteSyncError = $state<string | null>(null);

    $effect(() => {
        if (!airportRouteData) {
            airportRouteSyncError = null;
            return;
        }

        try {
            appContext.application.syncAirportRouteData(airportRouteData);
            airportRouteSyncError = null;
        } catch (error) {
            airportRouteSyncError = error instanceof Error ? error.message : String(error);
        }
    });

    const repositories = $derived(appContext.airport.repositories);
    const airportRouteQueryError = $derived.by(() => {
        const error = airportRouteDataQuery.error;
        if (!error) {
            return null;
        }

        return error instanceof Error ? error.message : String(error);
    });
    const repositoriesLoading = $derived(
        (airportRouteDataQuery.loading ?? false)
            || appContext.application.repositoriesLoading,
    );
    const repositoriesError = $derived(
        airportRouteSyncError
            ?? airportRouteQueryError
            ?? appContext.application.airportHomeError
            ?? appContext.application.repositoriesError,
    );
</script>

<div class="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
    {#if repositoriesLoading && repositories.length === 0}
        <section
            class="rounded-2xl border bg-card/70 px-5 py-4 text-sm text-muted-foreground backdrop-blur-sm"
        >
            Loading repositories...
        </section>
    {:else if repositoriesError && repositories.length === 0}
        <section
            class="rounded-2xl border bg-card/70 px-5 py-4 backdrop-blur-sm"
        >
            <h2 class="text-lg font-semibold text-foreground">Repositories</h2>
            <p class="mt-3 text-sm text-rose-600">
                {repositoriesError}
            </p>
        </section>
    {:else}
        <AirportHomeStatus />

        <div
            class="mt-4 grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.05fr_0.95fr] xl:overflow-hidden"
        >
            <RepositoryList />

            <AirportHomeAddRepository />
        </div>
    {/if}
</div>
