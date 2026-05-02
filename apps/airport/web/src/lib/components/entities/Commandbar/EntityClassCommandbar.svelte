<script lang="ts">
    import type { EntityCommandDescriptorType } from "@flying-pillow/mission-core/entities/Entity/EntitySchema";
    import type { ButtonVariant } from "$lib/components/ui/button/index.js";
    import { Entity } from "$lib/components/entities/shared/Entity.svelte.js";
    import EntityCommandbar from "./EntityCommandbar.svelte";
    import type { CommandableEntity } from "./CommandableEntity";

    let {
        refreshNonce,
        entityName,
        commandInput,
        executeCommand,
        onCommandExecuted,
        class: className,
        buttonClass = "",
        defaultVariant = "default",
        showEmptyState = false,
        showLoadingState = true,
    }: {
        refreshNonce: number;
        entityName: string;
        commandInput?: unknown;
        executeCommand?: (
            commandId: string,
            input?: unknown,
        ) => Promise<unknown>;
        onCommandExecuted: (
            result: unknown,
            command: EntityCommandDescriptorType,
        ) => Promise<void>;
        class?: string;
        buttonClass?: string;
        defaultVariant?: ButtonVariant;
        showEmptyState?: boolean;
        showLoadingState?: boolean;
    } = $props();

    let commands = $state<EntityCommandDescriptorType[]>([]);
    let loading = $state(false);
    let loadError = $state<string | null>(null);

    const commandEntity = $derived<CommandableEntity>({
        entityName,
        entityId: entityName,
        commands,
        executeCommand: async (commandId, input) => {
            if (executeCommand) {
                return await executeCommand(commandId, input);
            }

            return await Entity.executeClassCommand(
                entityName,
                commandId,
                input ?? commandInput,
            );
        },
    });

    $effect(() => {
        refreshNonce;
        entityName;
        commandInput;

        let cancelled = false;
        loading = true;
        loadError = null;

        void Entity.classCommands(entityName, commandInput)
            .then((nextCommands) => {
                if (!cancelled) {
                    commands = nextCommands;
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    commands = [];
                    loadError =
                        error instanceof Error ? error.message : String(error);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    loading = false;
                }
            });

        return () => {
            cancelled = true;
        };
    });
</script>

<div class="space-y-2">
    <EntityCommandbar
        {refreshNonce}
        entity={commandEntity}
        class={className}
        {buttonClass}
        {defaultVariant}
        showEmptyState={showEmptyState && !loading}
        {onCommandExecuted}
    />

    {#if showLoadingState && loading}
        <p class="text-sm text-muted-foreground">Loading commands...</p>
    {/if}

    {#if loadError}
        <p class="text-sm text-rose-600">{loadError}</p>
    {/if}
</div>
