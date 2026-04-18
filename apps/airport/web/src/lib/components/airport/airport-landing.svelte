<script lang="ts">
    const highlights = [
        {
            title: "Mission control",
            text: "A clean entry point for the operator experience, status surfaces, and workflow navigation.",
        },
        {
            title: "Repository network",
            text: "Use the sidebar as the persistent map of the workspace areas that matter to the mission.",
        },
        {
            title: "Scaffold first",
            text: "This landing page keeps the frame only, leaving the detailed modules ready for future content.",
        },
    ] as const;

    const sections = [
        {
            title: "Overview panel",
            text: "Reserved for mission status, active workflows, and runtime summaries.",
        },
        {
            title: "Workspace panel",
            text: "Reserved for repository insights, package health, and surface ownership.",
        },
        {
            title: "Operations panel",
            text: "Reserved for tasks, queues, and human-in-the-loop actions.",
        },
        {
            title: "Notes panel",
            text: "Reserved for release notes, checkpoints, and mission annotations.",
        },
    ] as const;
</script>

<section class="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
    <div
        class="overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-muted/60"
    >
        <div
            class="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between"
        >
            <div class="max-w-3xl space-y-4">
                <p
                    class="text-muted-foreground text-sm font-medium uppercase tracking-[0.3em]"
                >
                    Flying-Pillow Mission
                </p>
                <div class="space-y-3">
                    <h2
                        class="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
                    >
                        Airport is ready for your mission dashboard.
                    </h2>
                    <p
                        class="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base"
                    >
                        A minimal landing surface for the Mission workspace,
                        designed to keep the dashboard frame in place while the
                        real modules are added incrementally.
                    </p>
                </div>
            </div>

            <div class="flex flex-wrap gap-3">
                <a
                    href="https://github.com/Flying-Pillow/mission"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                    Open repository
                </a>
                <a
                    href="https://github.com/Flying-Pillow/mission/tree/main/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                    Browse docs
                </a>
            </div>
        </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
        {#each highlights as highlight (highlight.title)}
            <article class="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 class="text-base font-semibold">{highlight.title}</h3>
                <p class="mt-2 text-sm leading-6 text-muted-foreground">
                    {highlight.text}
                </p>
            </article>
        {/each}
    </div>

    <div
        class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]"
    >
        <div class="rounded-2xl border bg-card p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <h3 class="text-base font-semibold">Mission canvas</h3>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Keep this area open for the primary dashboard modules.
                    </p>
                </div>
                <span
                    class="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                    Scaffold
                </span>
            </div>

            <div class="mt-5 grid gap-4 md:grid-cols-2">
                {#each sections as section (section.title)}
                    <div
                        class="rounded-xl border border-dashed bg-muted/30 p-4"
                    >
                        <h4 class="text-sm font-medium">{section.title}</h4>
                        <p class="mt-2 text-sm leading-6 text-muted-foreground">
                            {section.text}
                        </p>
                    </div>
                {/each}
            </div>
        </div>

        <aside class="rounded-2xl border bg-card p-5 shadow-sm">
            <h3 class="text-base font-semibold">Launch pad</h3>
            <p class="mt-1 text-sm text-muted-foreground">
                Use this column for next actions, release checkpoints, or
                operator prompts.
            </p>

            <div class="mt-5 space-y-3">
                <div class="rounded-xl border border-dashed p-4">
                    <div class="text-sm font-medium">Primary actions</div>
                    <div class="mt-2 text-sm text-muted-foreground">
                        Placeholder for create, review, and dispatch controls.
                    </div>
                </div>
                <div class="rounded-xl border border-dashed p-4">
                    <div class="text-sm font-medium">Mission updates</div>
                    <div class="mt-2 text-sm text-muted-foreground">
                        Placeholder for summary notes, incidents, and latest
                        workflow changes.
                    </div>
                </div>
                <div class="rounded-xl border border-dashed p-4">
                    <div class="text-sm font-medium">Operator handoff</div>
                    <div class="mt-2 text-sm text-muted-foreground">
                        Placeholder for ownership, shifts, and collaboration
                        checkpoints.
                    </div>
                </div>
            </div>
        </aside>
    </div>
</section>
