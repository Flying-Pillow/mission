<script lang="ts">
    import AgentSession from "$lib/components/entities/AgentSession/AgentSession.svelte";
    import type { AgentSession as AgentSessionEntity } from "$lib/components/entities/AgentSession/AgentSession.svelte.js";
    import Artifact from "$lib/components/entities/Artifact/Artifact.svelte";
    import type { Artifact as ArtifactEntity } from "$lib/components/entities/Artifact/Artifact.svelte.js";
    import type { Task as TaskEntity } from "$lib/components/entities/Task/Task.svelte.js";
    import TaskCommandbar from "$lib/components/entities/Task/TaskCommandbar.svelte";
    import type { RepositoryAgentRunnerSettingsType } from "@flying-pillow/mission-core/entities/Repository/RepositorySchema";
    import {
        ResizableHandle,
        ResizablePane,
        ResizablePaneGroup,
    } from "$lib/components/ui/resizable";
    import * as Tabs from "$lib/components/ui/tabs/index.js";

    let {
        refreshNonce,
        agentRunners = [],
        artifacts = [],
        selectedArtifactId,
        task,
        session,
        onCommandExecuted,
    }: {
        refreshNonce: number;
        agentRunners?: RepositoryAgentRunnerSettingsType[];
        artifacts?: ArtifactEntity[];
        selectedArtifactId?: string;
        task?: TaskEntity;
        session?: AgentSessionEntity;
        onCommandExecuted: () => Promise<void>;
    } = $props();

    let activeArtifactTab = $state("");
    let lastSelectedArtifactId = $state<string | undefined>(undefined);

    const panelLabel = $derived(task?.title ?? "Task");
    const artifactTabs = $derived.by(() => {
        const tabs: ArtifactEntity[] = [];
        for (const candidate of artifacts) {
            if (tabs.some((artifactTab) => artifactTab.id === candidate.id)) {
                continue;
            }
            tabs.push(candidate);
        }
        return tabs;
    });
    $effect(() => {
        const selectedArtifactChanged =
            selectedArtifactId !== lastSelectedArtifactId;
        if (selectedArtifactChanged) {
            lastSelectedArtifactId = selectedArtifactId;
        }

        if (artifactTabs.length === 0) {
            activeArtifactTab = "";
            return;
        }

        const selectedArtifactExists = Boolean(
            selectedArtifactId &&
                artifactTabs.some(
                    (candidate) => candidate.id === selectedArtifactId,
                ),
        );
        if (
            selectedArtifactChanged &&
            selectedArtifactId &&
            selectedArtifactExists
        ) {
            activeArtifactTab = selectedArtifactId;
            return;
        }

        if (selectedArtifactChanged && !selectedArtifactId) {
            activeArtifactTab = artifactTabs[0].id;
            return;
        }

        if (
            !artifactTabs.some(
                (candidate) => candidate.id === activeArtifactTab,
            )
        ) {
            activeArtifactTab = artifactTabs[0].id;
        }
    });

    function artifactTabLabel(artifact: ArtifactEntity): string {
        if (artifact.taskId && (!task || artifact.taskId === task.taskId)) {
            return "Task";
        }

        return artifact.label;
    }
</script>

<section
    class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
>
    <header
        class="flex min-h-11 flex-wrap items-center gap-2 border bg-card/70 px-3 py-2 backdrop-blur-sm overflow-hidden"
    >
        <div class="min-w-0 flex-1">
            <h2 class="truncate text-sm font-semibold text-foreground">
                {panelLabel}
            </h2>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <TaskCommandbar
                {refreshNonce}
                {agentRunners}
                {task}
                {onCommandExecuted}
            />
        </div>
    </header>

    <ResizablePaneGroup
        direction="horizontal"
        class="min-h-0 flex-1 overflow-hidden"
        autoSaveId="task-panel"
    >
        <ResizablePane
            defaultSize={58}
            minSize={30}
            class="flex h-full min-h-0 flex-col"
        >
            {#if artifactTabs.length > 0}
                <Tabs.Root
                    bind:value={activeArtifactTab}
                    class="min-h-0 flex-1 overflow-hidden border bg-card/70 backdrop-blur-sm"
                >
                    <Tabs.List class="w-full overflow-x-auto overflow-y-hidden">
                        {#each artifactTabs as artifactTab (artifactTab.id)}
                            <Tabs.Trigger value={artifactTab.id}>
                                {artifactTabLabel(artifactTab)}
                            </Tabs.Trigger>
                        {/each}
                    </Tabs.List>

                    {#each artifactTabs as artifactTab (artifactTab.id)}
                        <Tabs.Content
                            value={artifactTab.id}
                            class="min-h-0 overflow-hidden"
                        >
                            <Artifact {refreshNonce} artifact={artifactTab} />
                        </Tabs.Content>
                    {/each}
                </Tabs.Root>
            {:else}
                <Artifact {refreshNonce} artifact={undefined} />
            {/if}
        </ResizablePane>

        <ResizableHandle withHandle />

        <ResizablePane
            defaultSize={42}
            minSize={28}
            class="flex h-full min-h-0 flex-col"
        >
            <AgentSession {refreshNonce} {session} {onCommandExecuted} />
        </ResizablePane>
    </ResizablePaneGroup>
</section>
