<!-- /apps/airport/web/src/routes/+page.svelte: Mission landing page with sidebar frame and GitHub login entry point. -->
<script lang="ts">
    import AirportHeader from "$lib/components/airport/airport-header.svelte";
    import AirportLanding from "$lib/components/airport/airport-landing.svelte";
    import AirportSidebar from "$lib/components/airport/airport-sidebar.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import {
        SidebarInset,
        SidebarProvider,
    } from "$lib/components/ui/sidebar/index.js";

    let { data, form } = $props<{
        data: {
            appContext: {
                daemon: {
                    running: boolean;
                    startedByHook: boolean;
                    message: string;
                    endpointPath?: string;
                    lastCheckedAt: string;
                };
                githubStatus: "connected" | "disconnected" | "unknown";
                user?: {
                    githubStatus: "connected" | "disconnected" | "unknown";
                };
            };
            loginHref: string;
            towerProjection?: {
                github: {
                    cliAvailable: boolean;
                    authenticated: boolean;
                    user?: string;
                    detail?: string;
                };
                repositoryLabel: string;
            };
        };
        form?: unknown;
    }>();

    const daemonStatusTone = $derived(
        data.appContext.daemon.running ? "connected" : "disconnected",
    );
    const githubProjection = $derived(data.towerProjection?.github);
    const githubStatusTone = $derived(
        githubProjection?.authenticated
            ? "connected"
            : githubProjection?.cliAvailable
              ? "disconnected"
              : data.appContext.githubStatus,
    );
    const githubAccountLabel = $derived(
        githubProjection?.user ??
            (githubStatusTone === "connected"
                ? "Authenticated GitHub account"
                : "No authenticated GitHub account"),
    );
</script>

<svelte:head>
    <title>Flying-Pillow Mission</title>
    <meta
        name="description"
        content="Airport dashboard scaffold and landing page for the Flying-Pillow Mission workspace."
    />
</svelte:head>

<SidebarProvider>
    <AirportSidebar variant="inset" appContext={data.appContext} />

    <SidebarInset>
        <AirportHeader />
        <div class="px-4 pb-4 pt-2">
            <div
                class="rounded-2xl border bg-card/70 px-5 py-4 backdrop-blur-sm"
            >
                <div
                    class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
                >
                    <div class="grid gap-3 sm:grid-cols-2">
                        <div
                            class="rounded-xl border bg-background/70 px-4 py-3"
                        >
                            <p
                                class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                            >
                                Daemon
                            </p>
                            <div class="mt-2 flex items-center gap-2">
                                <span
                                    class={`inline-flex size-2.5 rounded-full ${daemonStatusTone === "connected" ? "bg-emerald-500" : "bg-rose-500"}`}
                                ></span>
                                <p class="text-sm font-medium text-foreground">
                                    {daemonStatusTone === "connected"
                                        ? "Connected"
                                        : "Unavailable"}
                                </p>
                            </div>
                            <p class="mt-1 text-sm text-muted-foreground">
                                {data.appContext.daemon.message}
                            </p>
                        </div>
                        <div
                            class="rounded-xl border bg-background/70 px-4 py-3"
                        >
                            <p
                                class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                            >
                                GitHub
                            </p>
                            <div class="mt-2 flex items-center gap-2">
                                <span
                                    class={`inline-flex size-2.5 rounded-full ${githubStatusTone === "connected" ? "bg-emerald-500" : githubStatusTone === "disconnected" ? "bg-amber-500" : "bg-slate-400"}`}
                                ></span>
                                <p class="text-sm font-medium text-foreground">
                                    {githubAccountLabel}
                                </p>
                            </div>
                            <p class="mt-1 text-sm text-muted-foreground">
                                {githubProjection?.detail ??
                                    "Sign in with GitHub to enable Mission daemon workflows and repository controls."}
                            </p>
                        </div>
                    </div>
                    <Button href={data.loginHref} size="lg">
                        {githubStatusTone === "connected"
                            ? "Manage GitHub login"
                            : "Login with GitHub"}
                    </Button>
                </div>
            </div>
        </div>
        <AirportLanding />
    </SidebarInset>
</SidebarProvider>
