<script lang="ts">
    let {
        missionId,
        artifactPath,
        artifactLabel,
    }: {
        missionId: string;
        artifactPath?: string;
        artifactLabel?: string;
    } = $props();

    let content = $state("");
    let originalContent = $state("");
    let loading = $state(false);
    let error = $state<string | null>(null);
    let loadedPath = $state<string | null>(null);
    const panelLabel = $derived(
        artifactLabel ?? basename(artifactPath) ?? "Resolved artifact",
    );

    $effect(() => {
        if (!artifactPath) {
            content = "";
            originalContent = "";
            loadedPath = null;
            error = null;
            return;
        }

        if (artifactPath === loadedPath) {
            return;
        }

        void loadArtifactDocument(artifactPath);
    });

    async function loadArtifactDocument(path: string): Promise<void> {
        loading = true;
        error = null;

        try {
            const response = await fetch(
                `/api/runtime/missions/${encodeURIComponent(missionId)}/documents?path=${encodeURIComponent(path)}`,
            );
            if (!response.ok) {
                throw new Error(`Artifact load failed (${response.status}).`);
            }

            const payload = (await response.json()) as {
                content: string;
                updatedAt?: string;
            };
            content = payload.content;
            originalContent = payload.content;
            loadedPath = path;
        } catch (loadError) {
            error =
                loadError instanceof Error
                    ? loadError.message
                    : String(loadError);
        } finally {
            loading = false;
        }
    }

    function basename(filePath: string | undefined): string | undefined {
        if (!filePath) {
            return undefined;
        }
        const normalized = filePath.replace(/\\/g, "/");
        return normalized.split("/").pop() ?? normalized;
    }
</script>

<section
    class="h-full grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border bg-card/70 px-5 py-4 backdrop-blur-sm"
>
    <header class="space-y-2 border-b pb-3">
        <div>
            <h2 class="text-sm font-semibold text-foreground">
                {panelLabel}
            </h2>
            <p class="mt-1 break-all text-xs text-muted-foreground">
                {artifactPath ??
                    "No artifact resolves from the current mission-control selection."}
            </p>
        </div>

        {#if error}
            <p class="text-sm text-rose-600">{error}</p>
        {/if}
    </header>

    <div class="min-h-0 pt-3">
        {#if artifactPath}
            <textarea
                bind:value={content}
                spellcheck="false"
                class="h-full min-h-[24rem] w-full resize-none rounded-xl border bg-background/80 px-4 py-4 font-mono text-sm leading-6 text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            ></textarea>
        {:else}
            <div
                class="flex h-full min-h-[24rem] items-center justify-center rounded-xl border border-dashed bg-background/60 px-6 py-8 text-center text-sm text-muted-foreground"
            >
                Select a stage, task, or artifact row to resolve the document
                that belongs in the operator editor pane.
            </div>
        {/if}
    </div>
</section>
