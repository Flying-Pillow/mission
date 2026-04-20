<!-- /apps/airport/web/src/lib/components/airport/airport-sidebar.svelte: Sidebar frame for the Airport web surface, including optional GitHub user menu. -->
<script lang="ts">
    import { page } from "$app/state";
    import { asset } from "$app/paths";
    import CalendarIcon from "@tabler/icons-svelte/icons/calendar";
    import ChevronRightIcon from "@tabler/icons-svelte/icons/chevron-right";
    import DashboardIcon from "@tabler/icons-svelte/icons/dashboard";
    import DatabaseIcon from "@tabler/icons-svelte/icons/database";
    import FileDescriptionIcon from "@tabler/icons-svelte/icons/file-description";
    import FolderIcon from "@tabler/icons-svelte/icons/folder";
    import HelpIcon from "@tabler/icons-svelte/icons/help";
    import OctagonIcon from "@tabler/icons-svelte/icons/octagon";
    import SearchIcon from "@tabler/icons-svelte/icons/search";
    import SettingsIcon from "@tabler/icons-svelte/icons/settings";
    import { getAppContext } from "$lib/client/context/app-context.svelte";
    import NavSecondary from "$lib/components/nav-secondary.svelte";
    import NavUser from "$lib/components/nav-user.svelte";
    import * as Collapsible from "$lib/components/ui/collapsible/index.js";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import type { MissionTowerTreeNode } from "@flying-pillow/mission-core/types.js";
    import type { Icon } from "@tabler/icons-svelte";
    import type { ComponentProps } from "svelte";

    type MissionSidebarTask = {
        node: MissionTowerTreeNode;
        artifacts: MissionTowerTreeNode[];
        sessions: MissionTowerTreeNode[];
    };

    type MissionSidebarStage = {
        node: MissionTowerTreeNode;
        artifacts: MissionTowerTreeNode[];
        tasks: MissionSidebarTask[];
    };

    const logo = asset("/logo.png");
    const appContext = getAppContext();

    const bottomMenu = [
        {
            title: "Settings",
            url: "https://github.com/Flying-Pillow/mission",
            icon: SettingsIcon,
        },
        {
            title: "Get Help",
            url: "https://github.com/Flying-Pillow/mission/issues",
            icon: HelpIcon,
        },
        {
            title: "Search",
            url: "https://github.com/Flying-Pillow/mission/search",
            icon: SearchIcon,
        },
    ] satisfies { title: string; url: string; icon: Icon }[];

    let { ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

    const workspaceUser = $derived.by(() => {
        if (!appContext?.user?.name) {
            return undefined;
        }

        return {
            name: appContext.user.name,
            ...(appContext.user.email ? { email: appContext.user.email } : {}),
            githubStatus: appContext.user.githubStatus,
            avatar: appContext.user.avatarUrl ?? logo,
        };
    });

    const routeSegments = $derived(
        page.url.pathname.split("/").filter((segment) => segment.length > 0),
    );
    const activeRepositoryId = $derived(
        routeSegments[0] === "repository"
            ? decodeURIComponent(routeSegments[1] ?? "")
            : undefined,
    );
    const missionOutline = $derived.by(() => {
        const outline = appContext.airport.activeMissionOutline;
        const treeNodes = outline?.treeNodes ?? [];

        if (treeNodes.length === 0) {
            return undefined;
        }

        return {
            title:
                outline?.title ??
                appContext.airport.activeMissionId ??
                "Mission outline",
            currentStageId: outline?.currentStageId,
            stages: buildMissionOutline(treeNodes),
        };
    });
    const activeMissionSelectedNodeId = $derived(
        appContext.airport.activeMissionSelectedNodeId,
    );
    const currentMissionStageId = $derived(missionOutline?.currentStageId);
    let missionBranchOverrides = $state<Record<string, boolean>>({});

    const sidebarRepositories = $derived.by(() => {
        return (appContext?.airport.repositories ?? []).map((repository) => {
            const isSelected = repository.repositoryId === activeRepositoryId;

            return {
                ...repository,
                icon: (isSelected ? DashboardIcon : FolderIcon) satisfies Icon,
                href: `/repository/${encodeURIComponent(repository.repositoryId)}`,
            };
        });
    });

    function buildMissionOutline(
        treeNodes: MissionTowerTreeNode[],
    ): MissionSidebarStage[] {
        const stages: MissionSidebarStage[] = [];
        const stageMap: Record<string, MissionSidebarStage> = {};
        const taskMap: Record<string, MissionSidebarTask> = {};

        for (const node of treeNodes) {
            if (node.kind === "stage") {
                const stage = {
                    node,
                    artifacts: [],
                    tasks: [],
                } satisfies MissionSidebarStage;
                stages.push(stage);
                if (node.stageId) {
                    stageMap[node.stageId] = stage;
                }
                continue;
            }

            const stage = node.stageId ? stageMap[node.stageId] : undefined;
            if (!stage) {
                continue;
            }

            if (node.kind === "stage-artifact") {
                stage.artifacts.push(node);
                continue;
            }

            if (node.kind === "task") {
                const task = {
                    node,
                    artifacts: [],
                    sessions: [],
                } satisfies MissionSidebarTask;
                stage.tasks.push(task);
                if (node.taskId) {
                    taskMap[node.taskId] = task;
                }
                continue;
            }

            const task = node.taskId ? taskMap[node.taskId] : undefined;
            if (!task) {
                continue;
            }

            if (node.kind === "task-artifact") {
                task.artifacts.push(node);
                continue;
            }

            if (node.kind === "session") {
                task.sessions.push(node);
            }
        }

        return stages;
    }

    function basename(filePath: string | undefined): string | undefined {
        if (!filePath) {
            return undefined;
        }

        const normalized = filePath.replace(/\\/g, "/");
        return normalized.split("/").pop() ?? normalized;
    }

    function nodeLabel(node: MissionTowerTreeNode): string {
        return basename(node.sourcePath) ?? node.label;
    }

    function nodeColor(node: MissionTowerTreeNode): string | undefined {
        const color = node.color?.trim();
        return color && color.length > 0 ? color : undefined;
    }

    function sessionIcon(node: MissionTowerTreeNode): Icon {
        return normalizeStatusLabel(node.statusLabel) === "terminated"
            ? OctagonIcon
            : DatabaseIcon;
    }

    function hasStageChildren(stage: MissionSidebarStage): boolean {
        return stage.artifacts.length > 0 || stage.tasks.length > 0;
    }

    function hasTaskChildren(task: MissionSidebarTask): boolean {
        return task.artifacts.length > 0 || task.sessions.length > 0;
    }

    function normalizeStatusLabel(statusLabel: string | undefined): string {
        return statusLabel?.trim().toLowerCase() ?? "";
    }

    function isActiveTaskStatus(statusLabel: string | undefined): boolean {
        const normalizedStatus = normalizeStatusLabel(statusLabel);

        return [
            "active",
            "queued",
            "running",
            "starting",
            "awaiting input",
        ].includes(normalizedStatus);
    }

    function isTaskDefaultOpen(task: MissionSidebarTask): boolean {
        return (
            hasTaskChildren(task) &&
            (isActiveTaskStatus(task.node.statusLabel) ||
                taskContainsSelectedNode(task) ||
                task.sessions.some((session) =>
                    isActiveTaskStatus(session.statusLabel),
                ))
        );
    }

    function isStageDefaultOpen(stage: MissionSidebarStage): boolean {
        return (
            hasStageChildren(stage) &&
            (stage.node.stageId === currentMissionStageId ||
                isActiveTaskStatus(stage.node.statusLabel) ||
                stageContainsSelectedNode(stage) ||
                stage.tasks.some((task) => isTaskDefaultOpen(task)))
        );
    }

    function taskContainsSelectedNode(task: MissionSidebarTask): boolean {
        return (
            activeMissionSelectedNodeId === task.node.id ||
            task.artifacts.some(
                (artifact) => artifact.id === activeMissionSelectedNodeId,
            ) ||
            task.sessions.some(
                (session) => session.id === activeMissionSelectedNodeId,
            )
        );
    }

    function stageContainsSelectedNode(stage: MissionSidebarStage): boolean {
        return (
            activeMissionSelectedNodeId === stage.node.id ||
            stage.artifacts.some(
                (artifact) => artifact.id === activeMissionSelectedNodeId,
            ) ||
            stage.tasks.some((task) => taskContainsSelectedNode(task))
        );
    }

    function isBranchOpen(nodeId: string, defaultOpen: boolean): boolean {
        return missionBranchOverrides[nodeId] ?? defaultOpen;
    }

    function setBranchOpen(nodeId: string, open: boolean): void {
        missionBranchOverrides[nodeId] = open;
    }

    function isStageExpanded(stage: MissionSidebarStage): boolean {
        return isBranchOpen(stage.node.id, isStageDefaultOpen(stage));
    }

    function isTaskExpanded(task: MissionSidebarTask): boolean {
        return isBranchOpen(task.node.id, isTaskDefaultOpen(task));
    }

    function selectMissionNode(nodeId: string): void {
        appContext.setActiveMissionSelectedNodeId(nodeId);
    }
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
    <Sidebar.Header>
        <Sidebar.Menu>
            <Sidebar.MenuItem>
                <Sidebar.MenuButton
                    class="data-[slot=sidebar-menu-button]:!p-1.5"
                >
                    {#snippet child({ props })}
                        <a href="/" {...props}>
                            <img
                                src={logo}
                                alt="Flying-Pillow logo"
                                class="size-8 shrink-0 rounded-md object-contain"
                            />
                            <span
                                class="grid flex-1 text-left text-sm leading-tight"
                            >
                                <span class="font-semibold">Airport</span>
                                <span class="text-muted-foreground text-xs"
                                    >Flying-Pillow Mission</span
                                >
                            </span>
                        </a>
                    {/snippet}
                </Sidebar.MenuButton>
            </Sidebar.MenuItem>
        </Sidebar.Menu>
    </Sidebar.Header>

    <Sidebar.Content>
        <Sidebar.Group>
            <Sidebar.GroupLabel>Repositories</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
                <Sidebar.Menu>
                    {#if sidebarRepositories.length === 0}
                        <Sidebar.MenuItem>
                            <div
                                class="text-muted-foreground px-2 py-1.5 text-xs"
                            >
                                No repositories available
                            </div>
                        </Sidebar.MenuItem>
                    {:else}
                        {#each sidebarRepositories as repository (repository.repositoryId)}
                            <Sidebar.MenuItem>
                                <Sidebar.MenuButton class="h-auto py-2">
                                    {#snippet child({ props })}
                                        <a href={repository.href} {...props}>
                                            <repository.icon />
                                            <span
                                                class="grid min-w-0 flex-1 text-left leading-tight"
                                            >
                                                <span
                                                    class="truncate text-sm font-medium"
                                                    >{repository.label}</span
                                                >
                                                <span
                                                    class="text-muted-foreground truncate text-xs"
                                                >
                                                    {repository.description}
                                                </span>
                                            </span>
                                        </a>
                                    {/snippet}
                                </Sidebar.MenuButton>
                            </Sidebar.MenuItem>
                        {/each}
                    {/if}
                </Sidebar.Menu>
            </Sidebar.GroupContent>
        </Sidebar.Group>

        {#if missionOutline}
            <Sidebar.Group>
                <Sidebar.GroupLabel>Mission Outline</Sidebar.GroupLabel>
                <Sidebar.GroupContent>
                    <Sidebar.Menu>
                        {#each missionOutline.stages as stage (stage.node.id)}
                            <Collapsible.Root
                                class="group/collapsible"
                                bind:open={
                                    () => isStageExpanded(stage),
                                    (open) => setBranchOpen(stage.node.id, open)
                                }
                            >
                                <Sidebar.MenuItem>
                                    {#if hasStageChildren(stage)}
                                        <Collapsible.Trigger>
                                            {#snippet child({ props })}
                                                <Sidebar.MenuButton
                                                    {...props}
                                                    class="h-auto py-2"
                                                    isActive={activeMissionSelectedNodeId ===
                                                        stage.node.id ||
                                                        stage.node.stageId ===
                                                            missionOutline.currentStageId}
                                                    variant={activeMissionSelectedNodeId ===
                                                        stage.node.id ||
                                                    stage.node.stageId ===
                                                        missionOutline.currentStageId
                                                        ? "outline"
                                                        : "default"}
                                                >
                                                    {#snippet child({
                                                        props: buttonProps,
                                                    })}
                                                        <button
                                                            type="button"
                                                            {...buttonProps}
                                                            onclick={() =>
                                                                selectMissionNode(
                                                                    stage.node
                                                                        .id,
                                                                )}
                                                            aria-label={`${isStageExpanded(stage) ? "Collapse" : "Expand"} ${stage.node.label}`}
                                                            aria-expanded={isStageExpanded(
                                                                stage,
                                                            )}
                                                        >
                                                            <CalendarIcon
                                                                style={`color: ${nodeColor(stage.node) ?? "currentColor"};`}
                                                            />
                                                            <span
                                                                class="min-w-0 flex-1 truncate text-left text-sm font-medium leading-tight"
                                                                style={`color: ${nodeColor(stage.node) ?? "currentColor"};`}
                                                            >
                                                                {stage.node
                                                                    .label}
                                                            </span>
                                                            <ChevronRightIcon
                                                                class="ms-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
                                                            />
                                                        </button>
                                                    {/snippet}
                                                </Sidebar.MenuButton>
                                            {/snippet}
                                        </Collapsible.Trigger>
                                    {:else}
                                        <Sidebar.MenuButton
                                            class="h-auto py-2"
                                            isActive={activeMissionSelectedNodeId ===
                                                stage.node.id ||
                                                stage.node.stageId ===
                                                    missionOutline.currentStageId}
                                            variant={activeMissionSelectedNodeId ===
                                                stage.node.id ||
                                            stage.node.stageId ===
                                                missionOutline.currentStageId
                                                ? "outline"
                                                : "default"}
                                        >
                                            {#snippet child({ props })}
                                                <button
                                                    type="button"
                                                    {...props}
                                                    onclick={() =>
                                                        selectMissionNode(
                                                            stage.node.id,
                                                        )}
                                                >
                                                    <CalendarIcon
                                                        style={`color: ${nodeColor(stage.node) ?? "currentColor"};`}
                                                    />
                                                    <span
                                                        class="min-w-0 flex-1 truncate text-left text-sm font-medium leading-tight"
                                                        style={`color: ${nodeColor(stage.node) ?? "currentColor"};`}
                                                    >
                                                        {stage.node.label}
                                                    </span>
                                                </button>
                                            {/snippet}
                                        </Sidebar.MenuButton>
                                    {/if}

                                    {#if hasStageChildren(stage)}
                                        <Collapsible.Content>
                                            <Sidebar.MenuSub>
                                                {#each stage.artifacts as artifact (artifact.id)}
                                                    <Sidebar.MenuSubItem>
                                                        <Sidebar.MenuSubButton
                                                            isActive={activeMissionSelectedNodeId ===
                                                                artifact.id}
                                                        >
                                                            {#snippet child({
                                                                props,
                                                            })}
                                                                <button
                                                                    type="button"
                                                                    {...props}
                                                                    onclick={() =>
                                                                        selectMissionNode(
                                                                            artifact.id,
                                                                        )}
                                                                >
                                                                    <FileDescriptionIcon
                                                                        style={`color: ${nodeColor(artifact) ?? "currentColor"};`}
                                                                    />
                                                                    <span
                                                                        class="min-w-0 flex-1 truncate text-left leading-tight"
                                                                        style={`color: ${nodeColor(artifact) ?? "currentColor"};`}
                                                                    >
                                                                        {nodeLabel(
                                                                            artifact,
                                                                        )}
                                                                    </span>
                                                                </button>
                                                            {/snippet}
                                                        </Sidebar.MenuSubButton>
                                                    </Sidebar.MenuSubItem>
                                                {/each}

                                                {#each stage.tasks as task (task.node.id)}
                                                    <Collapsible.Root
                                                        class="group/task-collapsible"
                                                        bind:open={
                                                            () =>
                                                                isTaskExpanded(
                                                                    task,
                                                                ),
                                                            (open) =>
                                                                setBranchOpen(
                                                                    task.node
                                                                        .id,
                                                                    open,
                                                                )
                                                        }
                                                    >
                                                        <Sidebar.MenuSubItem>
                                                            {#if hasTaskChildren(task)}
                                                                <Collapsible.Trigger
                                                                >
                                                                    {#snippet child({
                                                                        props,
                                                                    })}
                                                                        <Sidebar.MenuSubButton
                                                                            {...props}
                                                                            isActive={activeMissionSelectedNodeId ===
                                                                                task
                                                                                    .node
                                                                                    .id}
                                                                        >
                                                                            {#snippet child({
                                                                                props: buttonProps,
                                                                            })}
                                                                                <button
                                                                                    type="button"
                                                                                    {...buttonProps}
                                                                                    onclick={() =>
                                                                                        selectMissionNode(
                                                                                            task
                                                                                                .node
                                                                                                .id,
                                                                                        )}
                                                                                    aria-label={`${isTaskExpanded(task) ? "Collapse" : "Expand"} ${task.node.label}`}
                                                                                    aria-expanded={isTaskExpanded(
                                                                                        task,
                                                                                    )}
                                                                                >
                                                                                    <DashboardIcon
                                                                                        style={`color: ${nodeColor(task.node) ?? "currentColor"};`}
                                                                                    />
                                                                                    <span
                                                                                        class="min-w-0 flex-1 truncate text-left leading-tight"
                                                                                        style={`color: ${nodeColor(task.node) ?? "currentColor"};`}
                                                                                    >
                                                                                        {task
                                                                                            .node
                                                                                            .label}
                                                                                    </span>
                                                                                    <ChevronRightIcon
                                                                                        class="ms-auto transition-transform group-data-[state=open]/task-collapsible:rotate-90"
                                                                                    />
                                                                                </button>
                                                                            {/snippet}
                                                                        </Sidebar.MenuSubButton>
                                                                    {/snippet}
                                                                </Collapsible.Trigger>
                                                            {:else}
                                                                <Sidebar.MenuSubButton
                                                                    isActive={activeMissionSelectedNodeId ===
                                                                        task
                                                                            .node
                                                                            .id}
                                                                >
                                                                    {#snippet child({
                                                                        props,
                                                                    })}
                                                                        <button
                                                                            type="button"
                                                                            {...props}
                                                                            onclick={() =>
                                                                                selectMissionNode(
                                                                                    task
                                                                                        .node
                                                                                        .id,
                                                                                )}
                                                                        >
                                                                            <DashboardIcon
                                                                                style={`color: ${nodeColor(task.node) ?? "currentColor"};`}
                                                                            />
                                                                            <span
                                                                                class="min-w-0 flex-1 truncate text-left leading-tight"
                                                                                style={`color: ${nodeColor(task.node) ?? "currentColor"};`}
                                                                            >
                                                                                {task
                                                                                    .node
                                                                                    .label}
                                                                            </span>
                                                                        </button>
                                                                    {/snippet}
                                                                </Sidebar.MenuSubButton>
                                                            {/if}

                                                            {#if hasTaskChildren(task)}
                                                                <Collapsible.Content
                                                                >
                                                                    <Sidebar.MenuSub
                                                                        class="mx-2 my-1"
                                                                    >
                                                                        {#each task.artifacts as artifact (artifact.id)}
                                                                            <Sidebar.MenuSubItem
                                                                            >
                                                                                <Sidebar.MenuSubButton
                                                                                    size="sm"
                                                                                    isActive={activeMissionSelectedNodeId ===
                                                                                        artifact.id}
                                                                                >
                                                                                    {#snippet child({
                                                                                        props,
                                                                                    })}
                                                                                        <button
                                                                                            type="button"
                                                                                            {...props}
                                                                                            onclick={() =>
                                                                                                selectMissionNode(
                                                                                                    artifact.id,
                                                                                                )}
                                                                                        >
                                                                                            <FileDescriptionIcon
                                                                                                style={`color: ${nodeColor(artifact) ?? "currentColor"};`}
                                                                                            />
                                                                                            <span
                                                                                                class="min-w-0 flex-1 truncate text-left leading-tight"
                                                                                                style={`color: ${nodeColor(artifact) ?? "currentColor"};`}
                                                                                            >
                                                                                                {nodeLabel(
                                                                                                    artifact,
                                                                                                )}
                                                                                            </span>
                                                                                        </button>
                                                                                    {/snippet}
                                                                                </Sidebar.MenuSubButton>
                                                                            </Sidebar.MenuSubItem>
                                                                        {/each}

                                                                        {#each task.sessions as session (session.id)}
                                                                            <Sidebar.MenuSubItem
                                                                            >
                                                                                {@const SessionIcon =
                                                                                    sessionIcon(
                                                                                        session,
                                                                                    )}
                                                                                <Sidebar.MenuSubButton
                                                                                    size="sm"
                                                                                    isActive={activeMissionSelectedNodeId ===
                                                                                        session.id}
                                                                                >
                                                                                    {#snippet child({
                                                                                        props,
                                                                                    })}
                                                                                        <button
                                                                                            type="button"
                                                                                            {...props}
                                                                                            onclick={() =>
                                                                                                selectMissionNode(
                                                                                                    session.id,
                                                                                                )}
                                                                                        >
                                                                                            <SessionIcon
                                                                                                style={`color: ${nodeColor(session) ?? "currentColor"};`}
                                                                                            />
                                                                                            <span
                                                                                                class="min-w-0 flex-1 truncate text-left leading-tight"
                                                                                                style={`color: ${nodeColor(session) ?? "currentColor"};`}
                                                                                            >
                                                                                                {nodeLabel(
                                                                                                    session,
                                                                                                )}
                                                                                            </span>
                                                                                        </button>
                                                                                    {/snippet}
                                                                                </Sidebar.MenuSubButton>
                                                                            </Sidebar.MenuSubItem>
                                                                        {/each}
                                                                    </Sidebar.MenuSub>
                                                                </Collapsible.Content>
                                                            {/if}
                                                        </Sidebar.MenuSubItem>
                                                    </Collapsible.Root>
                                                {/each}
                                            </Sidebar.MenuSub>
                                        </Collapsible.Content>
                                    {/if}
                                </Sidebar.MenuItem>
                            </Collapsible.Root>
                        {/each}
                    </Sidebar.Menu>
                </Sidebar.GroupContent>
            </Sidebar.Group>
        {/if}

        <NavSecondary items={bottomMenu} class="mt-auto" />
    </Sidebar.Content>

    {#if workspaceUser}
        <Sidebar.Footer>
            <NavUser user={workspaceUser} />
        </Sidebar.Footer>
    {/if}
</Sidebar.Root>
