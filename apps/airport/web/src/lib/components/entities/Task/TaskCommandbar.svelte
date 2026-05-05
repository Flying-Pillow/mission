<script lang="ts">
    import Icon from "@iconify/svelte";
    import {
        type MissionAgentRunnerType,
        type MissionReasoningEffortType,
    } from "@flying-pillow/mission-core/entities/Mission/MissionSchema";
    import {
        createDefaultRepositoryAgentRunnerSettings,
        readRepositoryAgentRunnerSettings,
        type RepositoryAgentRunnerSettingsType,
    } from "@flying-pillow/mission-core/entities/Repository/RepositorySchema";
    import type { EntityCommandDescriptorType } from "@flying-pillow/mission-core/entities/Entity/EntitySchema";
    import {
        TaskCommandIds,
        type TaskStartCommandOptionsType,
    } from "@flying-pillow/mission-core/entities/Task/TaskSchema";
    import EntityCommandbar from "$lib/components/entities/Commandbar/EntityCommandbar.svelte";
    import type { Task } from "$lib/components/entities/Task/Task.svelte.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
    import { Input } from "$lib/components/ui/input/index.js";

    type MenuOption<TValue extends string> = {
        value: TValue;
        label: string;
        description?: string;
    };

    const defaultSelectionOption = {
        value: "",
        label: "Task default",
        description: "Use task or repository settings",
    } as const;

    const allReasoningEffortOptions: MenuOption<
        "" | MissionReasoningEffortType
    >[] = [
        {
            value: "",
            label: "Task default",
            description: "Use task or repository settings",
        },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "xhigh", label: "XHigh" },
    ];

    let {
        refreshNonce,
        agentRunners = createDefaultRepositoryAgentRunnerSettings(),
        task,
        onCommandExecuted,
    }: {
        refreshNonce: number;
        agentRunners?: RepositoryAgentRunnerSettingsType[];
        task?: Task;
        onCommandExecuted: () => Promise<void>;
    } = $props();

    let initializedTaskId = $state<string | undefined>(undefined);
    let agentRunner = $state<MissionAgentRunnerType>("copilot-cli");
    let model = $state("");
    let customModel = $state("");
    let reasoningEffort = $state<"" | MissionReasoningEffortType>("");

    const agentRunnerCatalog = $derived(
        agentRunners.length > 0
            ? agentRunners
            : createDefaultRepositoryAgentRunnerSettings(),
    );
    const agentRunnerOptions = $derived(
        agentRunnerCatalog.map((entry) => ({
            value: entry.id,
            label: entry.label,
        })),
    );
    const defaultAgentRunner = $derived(agentRunnerCatalog[0]);
    const selectedAgentRunner = $derived(
        readRepositoryAgentRunnerSettings(
            { agentRunners: agentRunnerCatalog },
            agentRunner,
        ) ?? defaultAgentRunner,
    );

    const availableModelOptions = $derived.by(() => {
        const taskModel = task?.model?.trim();
        const options: MenuOption<string>[] = [
            defaultSelectionOption,
            ...selectedAgentRunner.models,
        ];
        if (
            taskModel &&
            !options.some((candidate) => candidate.value === taskModel)
        ) {
            options.splice(1, 0, {
                value: taskModel,
                label: taskModel,
                description: "Task configured model",
            });
        }
        if (model && !options.some((candidate) => candidate.value === model)) {
            options.splice(1, 0, {
                value: model,
                label: model,
                description: "Custom model",
            });
        }

        return options;
    });
    const reasoningEffortOptions = $derived.by(() => {
        const availableValues = new Set(selectedAgentRunner.reasoningEfforts);
        return allReasoningEffortOptions.filter(
            (option) =>
                option.value === "" || availableValues.has(option.value),
        );
    });
    const selectedAgentRunnerOption = $derived(
        agentRunnerOptions.find((option) => option.value === agentRunner) ??
            agentRunnerOptions[0],
    );
    const selectedModelOption = $derived(
        availableModelOptions.find((option) => option.value === model) ??
            defaultSelectionOption,
    );
    const selectedReasoningEffortOption = $derived(
        reasoningEffortOptions.find(
            (option) => option.value === reasoningEffort,
        ) ?? reasoningEffortOptions[0],
    );

    $effect(() => {
        if (initializedTaskId === task?.taskId) {
            return;
        }

        const taskAgentRunner = task?.agentRunner;
        agentRunner =
            readRepositoryAgentRunnerSettings(
                { agentRunners: agentRunnerCatalog },
                taskAgentRunner,
            )?.id ?? defaultAgentRunner.id;
        model = task?.model ?? "";
        customModel = "";
        reasoningEffort = task?.reasoningEffort ?? "";
        initializedTaskId = task?.taskId;
    });

    $effect(() => {
        const selectedModelIsAvailable =
            model &&
            availableModelOptions.some((option) => option.value === model);
        if (model && !selectedModelIsAvailable) {
            model = "";
        }
        if (
            !reasoningEffortOptions.some(
                (option) => option.value === reasoningEffort,
            )
        ) {
            reasoningEffort = "";
        }
    });

    function resolveCommandInput(
        command: EntityCommandDescriptorType,
    ): TaskStartCommandOptionsType | undefined {
        if (command.commandId !== TaskCommandIds.start) {
            return undefined;
        }

        return {
            agentRunner,
            ...(model ? { model } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
        };
    }

    function useCustomModel(): void {
        const nextModel = customModel.trim();
        if (!nextModel) {
            return;
        }

        model = nextModel;
    }
</script>

<div class="flex flex-wrap items-center gap-2">
    <DropdownMenu.Root>
        <DropdownMenu.Trigger>
            {#snippet child({ props })}
                <Button
                    variant="outline"
                    size="sm"
                    class="min-w-32 justify-between gap-2 bg-background/80"
                    disabled={!task}
                    aria-label="Agent runner"
                    title="Agent runner"
                    {...props}
                >
                    <Icon
                        icon="lucide:bot"
                        class="size-4"
                        data-icon="inline-start"
                    />
                    <span class="min-w-0 flex-1 truncate text-left">
                        {selectedAgentRunnerOption.label}
                    </span>
                    <Icon
                        icon="lucide:chevron-down"
                        class="size-4 opacity-60"
                    />
                </Button>
            {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
            align="end"
            sideOffset={6}
            class="min-w-56 rounded-lg"
        >
            <DropdownMenu.Label>Agent runner</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.RadioGroup bind:value={agentRunner}>
                {#each agentRunnerOptions as option (option.value)}
                    <DropdownMenu.RadioItem value={option.value}>
                        <span>{option.label}</span>
                    </DropdownMenu.RadioItem>
                {/each}
            </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
    </DropdownMenu.Root>

    <DropdownMenu.Root>
        <DropdownMenu.Trigger>
            {#snippet child({ props })}
                <Button
                    variant="outline"
                    size="sm"
                    class="min-w-36 justify-between gap-2 bg-background/80"
                    disabled={!task}
                    aria-label="Model"
                    title="Model"
                    {...props}
                >
                    <Icon
                        icon="lucide:cpu"
                        class="size-4"
                        data-icon="inline-start"
                    />
                    <span class="min-w-0 flex-1 truncate text-left">
                        {selectedModelOption.label}
                    </span>
                    <Icon
                        icon="lucide:chevron-down"
                        class="size-4 opacity-60"
                    />
                </Button>
            {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
            align="end"
            sideOffset={6}
            class="min-w-64 rounded-lg"
        >
            <DropdownMenu.Label>Model</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <div class="grid gap-2 px-2 py-2">
                <div class="flex items-center gap-2">
                    <Input
                        bind:value={customModel}
                        class="h-8 min-w-0 flex-1"
                        placeholder="Type model id"
                        aria-label="Custom model id"
                        onkeydown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                useCustomModel();
                            }
                        }}
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        class="h-8"
                        disabled={!customModel.trim()}
                        onclick={useCustomModel}
                    >
                        <Icon
                            icon="lucide:plus"
                            class="size-4"
                            data-icon="inline-start"
                        />
                        <span>Use</span>
                    </Button>
                </div>
            </div>
            <DropdownMenu.Separator />
            <DropdownMenu.RadioGroup bind:value={model}>
                {#each availableModelOptions as option (option.value)}
                    <DropdownMenu.RadioItem value={option.value}>
                        <span class="flex min-w-0 flex-col">
                            <span>{option.label}</span>
                            {#if option.description}
                                <span class="text-xs text-muted-foreground">
                                    {option.description}
                                </span>
                            {/if}
                        </span>
                    </DropdownMenu.RadioItem>
                {/each}
            </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
    </DropdownMenu.Root>

    <DropdownMenu.Root>
        <DropdownMenu.Trigger>
            {#snippet child({ props })}
                <Button
                    variant="outline"
                    size="sm"
                    class="min-w-32 justify-between gap-2 bg-background/80"
                    disabled={!task}
                    aria-label="Reasoning effort"
                    title="Reasoning effort"
                    {...props}
                >
                    <Icon
                        icon="lucide:gauge"
                        class="size-4"
                        data-icon="inline-start"
                    />
                    <span class="min-w-0 flex-1 truncate text-left">
                        {selectedReasoningEffortOption.label}
                    </span>
                    <Icon
                        icon="lucide:chevron-down"
                        class="size-4 opacity-60"
                    />
                </Button>
            {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
            align="end"
            sideOffset={6}
            class="min-w-56 rounded-lg"
        >
            <DropdownMenu.Label>Reasoning effort</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.RadioGroup bind:value={reasoningEffort}>
                {#each reasoningEffortOptions as option (option.value)}
                    <DropdownMenu.RadioItem value={option.value}>
                        <span class="flex min-w-0 flex-col">
                            <span>{option.label}</span>
                            {#if option.description}
                                <span class="text-xs text-muted-foreground">
                                    {option.description}
                                </span>
                            {/if}
                        </span>
                    </DropdownMenu.RadioItem>
                {/each}
            </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
    </DropdownMenu.Root>

    <EntityCommandbar
        {refreshNonce}
        entity={task}
        defaultVariant="default"
        buttonClass="shadow-sm shadow-primary/10"
        showEmptyState={false}
        {resolveCommandInput}
        {onCommandExecuted}
    />
</div>
