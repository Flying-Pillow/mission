<!-- /apps/airport/web/src/lib/components/airport/airport-sidebar.svelte: Sidebar frame for the Airport web surface, including optional GitHub user menu. -->
<script lang="ts">
    import { page } from "$app/state";
    import { asset } from "$app/paths";
    import BookIcon from "@tabler/icons-svelte/icons/book";
    import CalendarIcon from "@tabler/icons-svelte/icons/calendar";
    import DashboardIcon from "@tabler/icons-svelte/icons/dashboard";
    import FolderIcon from "@tabler/icons-svelte/icons/folder";
    import HelpIcon from "@tabler/icons-svelte/icons/help";
    import SearchIcon from "@tabler/icons-svelte/icons/search";
    import SettingsIcon from "@tabler/icons-svelte/icons/settings";
    import { getAppContext } from "$lib/client/context/app-context.svelte";
    import { getAirportSidebarNavigation } from "./airport-sidebar-navigation";
    import NavSecondary from "$lib/components/nav-secondary.svelte";
    import NavUser from "$lib/components/nav-user.svelte";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import {
        getRepositoryDisplayDescription,
        getRepositoryDisplayName,
    } from "$lib/components/entities/Repository/Repository.svelte.js";
    import type { Icon } from "@tabler/icons-svelte";
    import type { ComponentProps } from "svelte";
    import type {
        MissionSummary,
        SidebarRepositorySummary,
    } from "$lib/components/entities/types";

    type SidebarRepositoryView = SidebarRepositorySummary & { id: string };

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

    const airportUser = $derived.by(() => {
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
    const primaryNavigation = $derived(
        getAirportSidebarNavigation(page.url.pathname),
    );
    const activeRepositoryId = $derived(
        routeSegments[0] === "repository"
            ? decodeURIComponent(routeSegments[1] ?? "")
            : undefined,
    );
    const activeMissionId = $derived(appContext.airport.activeMissionId);
    const showRepositoryNavigation = $derived(routeSegments[0] !== "airport");

    const sidebarRepositories = $derived.by(() => {
        const repositories = (appContext?.airport.repositories ??
            []) as SidebarRepositoryView[];
        return repositories.map((repository) => {
            const isSelected = repository.id === activeRepositoryId;

            return {
                ...repository,
                displayName: getRepositoryDisplayName(repository),
                displayDescription: getRepositoryDisplayDescription(repository),
                icon: (isSelected ? DashboardIcon : FolderIcon) satisfies Icon,
                href: `/repository/${encodeURIComponent(repository.id)}`,
                missions: (repository.missions ?? []).map(
                    (mission: MissionSummary) => ({
                        ...mission,
                        href: `/repository/${encodeURIComponent(repository.id)}/missions/${encodeURIComponent(mission.missionId)}`,
                        isActive:
                            isSelected && mission.missionId === activeMissionId,
                    }),
                ),
            };
        });
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
                        <a href="/airport" {...props}>
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
            <Sidebar.GroupLabel>Navigate</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
                <Sidebar.Menu>
                    {#each primaryNavigation as item (item.href)}
                        <Sidebar.MenuItem>
                            <Sidebar.MenuButton isActive={item.isActive}>
                                {#snippet child({ props })}
                                    <a href={item.href} {...props}>
                                        <BookIcon />
                                        <span>{item.title}</span>
                                    </a>
                                {/snippet}
                            </Sidebar.MenuButton>
                        </Sidebar.MenuItem>
                    {/each}
                </Sidebar.Menu>
            </Sidebar.GroupContent>
        </Sidebar.Group>

        {#if showRepositoryNavigation}
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
                            {#each sidebarRepositories as repository (repository.id)}
                                <Sidebar.MenuItem>
                                    <Sidebar.MenuButton
                                        class="h-auto py-2"
                                        isActive={repository.id ===
                                            activeRepositoryId}
                                    >
                                        {#snippet child({ props })}
                                            <a
                                                href={repository.href}
                                                {...props}
                                            >
                                                <repository.icon />
                                                <span
                                                    class="grid min-w-0 flex-1 text-left leading-tight"
                                                >
                                                    <span
                                                        class="truncate text-sm font-medium"
                                                        >{repository.displayName}</span
                                                    >
                                                    <span
                                                        class="text-muted-foreground truncate text-xs"
                                                    >
                                                        {repository.displayDescription}
                                                    </span>
                                                </span>
                                            </a>
                                        {/snippet}
                                    </Sidebar.MenuButton>

                                    {#if repository.missions.length > 0}
                                        <Sidebar.MenuSub>
                                            {#each repository.missions as mission (mission.missionId)}
                                                <Sidebar.MenuSubItem>
                                                    <Sidebar.MenuSubButton
                                                        isActive={mission.isActive}
                                                    >
                                                        {#snippet child({
                                                            props,
                                                        })}
                                                            <a
                                                                href={mission.href}
                                                                {...props}
                                                            >
                                                                <CalendarIcon />
                                                                <span>
                                                                    {mission.title?.trim() ||
                                                                        mission.missionId}
                                                                </span>
                                                            </a>
                                                        {/snippet}
                                                    </Sidebar.MenuSubButton>
                                                </Sidebar.MenuSubItem>
                                            {/each}
                                        </Sidebar.MenuSub>
                                    {/if}
                                </Sidebar.MenuItem>
                            {/each}
                        {/if}
                    </Sidebar.Menu>
                </Sidebar.GroupContent>
            </Sidebar.Group>
        {/if}

        <NavSecondary items={bottomMenu} class="mt-auto" />
    </Sidebar.Content>

    {#if airportUser}
        <Sidebar.Footer>
            <NavUser user={airportUser} />
        </Sidebar.Footer>
    {/if}
</Sidebar.Root>
