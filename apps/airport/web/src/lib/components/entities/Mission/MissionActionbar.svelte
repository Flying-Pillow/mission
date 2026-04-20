<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import type { MissionControlComputedState } from "$lib/components/entities/Mission/missionControl";
    import AlertTriangleIcon from "@tabler/icons-svelte/icons/alert-triangle";
    import CircleCheckIcon from "@tabler/icons-svelte/icons/circle-check";
    import HandStopIcon from "@tabler/icons-svelte/icons/hand-stop";
    import PlayerPauseIcon from "@tabler/icons-svelte/icons/player-pause";
    import PlayerPlayIcon from "@tabler/icons-svelte/icons/player-play";
    import RefreshIcon from "@tabler/icons-svelte/icons/refresh";
    import RocketIcon from "@tabler/icons-svelte/icons/rocket";
    import type { Icon } from "@tabler/icons-svelte";
    import { orderAvailableActions } from "@flying-pillow/mission-core/browser";
    import type {
        OperatorActionDescriptor,
        OperatorActionListSnapshot,
        OperatorActionQueryContext,
        OperatorActionTargetContext,
    } from "@flying-pillow/mission-core/types.js";

    let {
        missionId,
        repositoryId,
        refreshNonce,
        selectionState,
        onActionExecuted,
    }: {
        missionId: string;
        repositoryId: string;
        refreshNonce: number;
        selectionState: MissionControlComputedState;
        onActionExecuted: () => Promise<void>;
    } = $props();

    let actionSnapshot = $state<OperatorActionListSnapshot | null>(null);
    let actionLoading = $state(false);
    let actionPending = $state<string | null>(null);
    let actionError = $state<string | null>(null);
    let loadedContextKey = $state<string | null>(null);
    let lastRefreshNonce = $state<number | null>(null);

    const actionContext = $derived.by(() => {
        const selection = selectionState.resolvedSelection;

        return {
            repositoryId,
            ...(selection?.stageId ? { stageId: selection.stageId } : {}),
            ...(selection?.taskId ? { taskId: selection.taskId } : {}),
            ...(selection?.activeAgentSessionId
                ? { sessionId: selection.activeAgentSessionId }
                : {}),
        } satisfies OperatorActionQueryContext;
    });
    const actionContextKey = $derived(JSON.stringify(actionContext));
    const selectedScopeLabel = $derived.by(() => {
        const node = selectionState.selectedNode;
        if (!node) {
            return "Actions";
        }

        return node.label;
    });
    const availableActions = $derived.by(() => {
        const snapshotActions = actionSnapshot?.actions ?? [];
        const orderedActions = orderAvailableActions(
            snapshotActions,
            actionContext as OperatorActionTargetContext,
        );

        return orderedActions.filter(
            (action) => action.enabled && !action.disabled,
        );
    });
    const scopedActions = $derived(
        availableActions.filter((action) => action.scope !== "mission"),
    );
    const missionActions = $derived(
        availableActions.filter((action) => action.scope === "mission"),
    );

    function actionVariant(
        action: OperatorActionDescriptor,
    ): "default" | "outline" | "secondary" | "destructive" {
        if (action.id.includes("panic")) {
            return "destructive";
        }

        if (action.scope === "mission") {
            return "outline";
        }

        return "default";
    }

    function actionClass(action: OperatorActionDescriptor): string {
        return action.scope === "mission"
            ? "shadow-sm"
            : "shadow-sm shadow-primary/10";
    }

    function getActionIcon(action: OperatorActionDescriptor): Icon {
        const actionId = action.id.toLowerCase();

        if (actionId.includes("resume") || actionId.includes("start")) {
            return PlayerPlayIcon;
        }

        if (actionId.includes("pause")) {
            return PlayerPauseIcon;
        }

        if (actionId.includes("panic") || actionId.includes("terminate")) {
            return AlertTriangleIcon;
        }

        if (actionId.includes("restart") || actionId.includes("reopen")) {
            return RefreshIcon;
        }

        if (actionId.includes("deliver") || actionId.includes("launch")) {
            return RocketIcon;
        }

        if (actionId.includes("block") || actionId.includes("cancel")) {
            return HandStopIcon;
        }

        return CircleCheckIcon;
    }

    $effect(() => {
        if (lastRefreshNonce !== refreshNonce) {
            loadedContextKey = null;
            lastRefreshNonce = refreshNonce;
        }

        if (!missionId || loadedContextKey === actionContextKey) {
            return;
        }

        void loadActions(actionContextKey, actionContext);
    });

    async function loadActions(
        contextKey: string,
        context: OperatorActionQueryContext,
    ): Promise<void> {
        actionLoading = true;
        actionError = null;
        try {
            const query = new URLSearchParams();
            if (context.repositoryId) {
                query.set("repositoryId", context.repositoryId);
            }
            if (context.stageId) {
                query.set("stageId", context.stageId);
            }
            if (context.taskId) {
                query.set("taskId", context.taskId);
            }
            if (context.sessionId) {
                query.set("sessionId", context.sessionId);
            }

            const response = await fetch(
                `/api/runtime/missions/${encodeURIComponent(missionId)}/actions?${query.toString()}`,
            );
            if (!response.ok) {
                throw new Error(
                    `Action list load failed (${response.status}).`,
                );
            }

            actionSnapshot =
                (await response.json()) as OperatorActionListSnapshot;
            loadedContextKey = contextKey;
        } catch (error) {
            actionError =
                error instanceof Error ? error.message : String(error);
        } finally {
            actionLoading = false;
        }
    }

    async function executeAction(
        action: OperatorActionDescriptor,
    ): Promise<void> {
        if (actionPending || action.disabled || !action.enabled) {
            return;
        }

        actionPending = action.id;
        actionError = null;
        try {
            const response = await fetch(
                `/api/runtime/missions/${encodeURIComponent(missionId)}/actions`,
                {
                    method: "POST",
                    headers: {
                        accept: "application/json",
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({
                        actionId: action.id,
                        steps: [],
                    }),
                },
            );
            if (!response.ok) {
                throw new Error(
                    `Action '${action.label}' failed (${response.status}).`,
                );
            }

            loadedContextKey = null;
            await onActionExecuted();
        } catch (error) {
            actionError =
                error instanceof Error ? error.message : String(error);
        } finally {
            actionPending = null;
        }
    }
</script>

<div class="space-y-2">
    <div
        class="flex min-h-11 w-full flex-wrap items-center gap-2 border bg-card/70 px-2 py-2 rounded-full"
    >
        <Button variant="secondary" size="sm" disabled
            >{selectedScopeLabel}</Button
        >

        <div
            class="bg-border/60 mx-1 hidden h-5 w-px self-center sm:block"
        ></div>

        {#if actionLoading && availableActions.length === 0}
            <Button variant="outline" size="sm" disabled
                >Loading actions...</Button
            >
        {:else if availableActions.length === 0}
            <Button variant="outline" size="sm" disabled
                >No actions available</Button
            >
        {:else}
            {#each scopedActions as action (action.id)}
                {@const Icon = getActionIcon(action)}
                <Button
                    variant={actionVariant(action)}
                    size="sm"
                    disabled={actionPending !== null}
                    class={actionClass(action)}
                    onclick={() => executeAction(action)}
                    title={action.disabledReason ||
                        action.reason ||
                        action.label}
                >
                    <Icon class="size-4" data-icon="inline-start" />
                    <span>
                        {actionPending === action.id
                            ? `${action.ui?.toolbarLabel ?? action.label}...`
                            : (action.ui?.toolbarLabel ?? action.label)}
                    </span>
                </Button>
            {/each}

            {#if scopedActions.length > 0 && missionActions.length > 0}
                <div class="flex-1"></div>
            {/if}

            {#each missionActions as action (action.id)}
                {@const Icon = getActionIcon(action)}
                <Button
                    variant={actionVariant(action)}
                    size="sm"
                    disabled={actionPending !== null}
                    class={actionClass(action)}
                    onclick={() => executeAction(action)}
                    title={action.disabledReason ||
                        action.reason ||
                        action.label}
                >
                    <Icon class="size-4" data-icon="inline-start" />
                    <span>
                        {actionPending === action.id
                            ? `${action.ui?.toolbarLabel ?? action.label}...`
                            : (action.ui?.toolbarLabel ?? action.label)}
                    </span>
                </Button>
            {/each}
        {/if}
    </div>

    {#if actionError}
        <p class="text-sm text-rose-600">{actionError}</p>
    {/if}
</div>
