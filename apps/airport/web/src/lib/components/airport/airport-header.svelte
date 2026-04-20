<script lang="ts">
    import { asset } from "$app/paths";
    import BrandGithubIcon from "@tabler/icons-svelte/icons/brand-github";
    import { getAppContext } from "$lib/client/context/app-context.svelte";
    import * as Avatar from "$lib/components/ui/avatar/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";

    const appContext = getAppContext();
    const fallbackAvatar = asset("/logo.png");
    const missionRepositoryUrl = "https://github.com/Flying-Pillow/mission";

    const headerIdentity = $derived.by(() => ({
        name: appContext.user?.name ?? "Mission Operator",
        avatar: appContext.user?.avatarUrl ?? fallbackAvatar,
    }));

    const userInitials = $derived.by(
        () =>
            headerIdentity.name
                .split(/[^A-Za-z0-9]+/u)
                .filter((segment) => segment.length > 0)
                .slice(0, 2)
                .map((segment) => segment[0]?.toUpperCase() ?? "")
                .join("") || "FP",
    );
</script>

<header
    class="flex-none flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
    <div class="flex w-full items-center gap-2 px-4 lg:px-6">
        <Sidebar.Trigger class="-ml-1" />
        <Separator
            orientation="vertical"
            class="mx-2 data-[orientation=vertical]:h-4"
        />
        <div class="min-w-0">
            <p
                class="text-muted-foreground text-[0.7rem] font-medium uppercase tracking-[0.25em]"
            >
                Flying-Pillow
            </p>
            <h1 class="truncate text-sm font-semibold sm:text-base">Mission</h1>
        </div>
        <div class="ms-auto flex items-center gap-2">
            <a
                href={missionRepositoryUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the Mission GitHub repository"
                title="Open Mission on GitHub"
                class="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-full border border-transparent transition-colors hover:border-border hover:bg-muted/60"
            >
                <BrandGithubIcon class="size-4" />
            </a>
            <div
                class="flex items-center gap-3 rounded-full border bg-background/80 px-2.5 py-1.5"
            >
                <Avatar.Root class="size-8 overflow-hidden rounded-full">
                    <Avatar.Image
                        src={headerIdentity.avatar}
                        alt={headerIdentity.name}
                    />
                    <Avatar.Fallback class="rounded-full text-xs font-medium">
                        {userInitials}
                    </Avatar.Fallback>
                </Avatar.Root>
                <span
                    class="hidden text-sm font-medium text-foreground sm:inline"
                >
                    {headerIdentity.name}
                </span>
            </div>
        </div>
    </div>
</header>
