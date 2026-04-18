<!-- /apps/airport/web/src/lib/components/airport/airport-sidebar.svelte: Sidebar frame for the Airport web surface, including optional GitHub user menu. -->
<script lang="ts">
    import { asset } from "$app/paths";
    import DashboardIcon from "@tabler/icons-svelte/icons/dashboard";
    import DatabaseIcon from "@tabler/icons-svelte/icons/database";
    import FileDescriptionIcon from "@tabler/icons-svelte/icons/file-description";
    import FolderIcon from "@tabler/icons-svelte/icons/folder";
    import HelpIcon from "@tabler/icons-svelte/icons/help";
    import SearchIcon from "@tabler/icons-svelte/icons/search";
    import SettingsIcon from "@tabler/icons-svelte/icons/settings";
    import NavSecondary from "$lib/components/nav-secondary.svelte";
    import NavUser from "$lib/components/nav-user.svelte";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import type { Icon } from "@tabler/icons-svelte";
    import type { ComponentProps } from "svelte";
    import type { AppContextValue } from "$lib/context/app-context.svelte";

    const logo = asset("/logo.png");

    type Repository = {
        name: string;
        description: string;
        href: string;
        icon: Icon;
    };

    const repositories: Repository[] = [
        {
            name: "mission",
            description: "Primary Flying-Pillow workspace",
            href: "https://github.com/Flying-Pillow/mission",
            icon: DashboardIcon,
        },
        {
            name: "apps/airport/web",
            description: "Airport web surface",
            href: "https://github.com/Flying-Pillow/mission/tree/main/apps/airport/web",
            icon: FolderIcon,
        },
        {
            name: "apps/airport/native",
            description: "Native shell",
            href: "https://github.com/Flying-Pillow/mission/tree/main/apps/airport/native",
            icon: FolderIcon,
        },
        {
            name: "packages/core",
            description: "Shared runtime and primitives",
            href: "https://github.com/Flying-Pillow/mission/tree/main/packages/core",
            icon: DatabaseIcon,
        },
        {
            name: "packages/airport",
            description: "Airport package surface",
            href: "https://github.com/Flying-Pillow/mission/tree/main/packages/airport",
            icon: FileDescriptionIcon,
        },
        {
            name: "packages/mission",
            description: "Mission domain package",
            href: "https://github.com/Flying-Pillow/mission/tree/main/packages/mission",
            icon: FileDescriptionIcon,
        },
    ];

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

    let {
        appContext,
        ...restProps
    }: ComponentProps<typeof Sidebar.Root> & {
        appContext?: AppContextValue;
    } = $props();

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
                    {#each repositories as repository (repository.name)}
                        <Sidebar.MenuItem>
                            <Sidebar.MenuButton class="h-auto py-2">
                                {#snippet child({ props })}
                                    <a
                                        href={repository.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        {...props}
                                    >
                                        <repository.icon />
                                        <span
                                            class="grid min-w-0 flex-1 text-left leading-tight"
                                        >
                                            <span
                                                class="truncate text-sm font-medium"
                                                >{repository.name}</span
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
                </Sidebar.Menu>
            </Sidebar.GroupContent>
        </Sidebar.Group>

        <NavSecondary items={bottomMenu} class="mt-auto" />
    </Sidebar.Content>

    {#if workspaceUser}
        <Sidebar.Footer>
            <NavUser user={workspaceUser} />
        </Sidebar.Footer>
    {/if}
</Sidebar.Root>
