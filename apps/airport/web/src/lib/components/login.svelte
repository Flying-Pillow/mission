<script lang="ts">
    import ArrowRightIcon from "@tabler/icons-svelte/icons/arrow-right";
    import BrandGithubIcon from "@tabler/icons-svelte/icons/brand-github";
    import CheckIcon from "@tabler/icons-svelte/icons/check";
    import MailIcon from "@tabler/icons-svelte/icons/mail";
    import KeyIcon from "@tabler/icons-svelte/icons/key";
    import ShieldHalfIcon from "@tabler/icons-svelte/icons/shield-half";
    import SparklesIcon from "@tabler/icons-svelte/icons/sparkles";
    import * as Avatar from "$lib/components/ui/avatar/index.js";
    import * as Badge from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { Label } from "$lib/components/ui/label/index.js";

    let {
        githubStatus,
        user,
        error,
        probe,
        redirectTo = "/",
    }: {
        githubStatus: "connected" | "disconnected" | "unknown";
        user?: {
            name: string;
            email?: string;
            avatarUrl?: string;
        };
        error?: string;
        probe: {
            status: "idle" | "success" | "error";
            message: string;
        };
        redirectTo?: string;
    } = $props();

    let githubToken = $state("");

    const statusTone = $derived(
        githubStatus === "connected"
            ? "connected"
            : githubStatus === "disconnected"
              ? "disconnected"
              : "unknown",
    );

    const statusLabel = $derived(
        statusTone === "connected"
            ? "Connected"
            : statusTone === "disconnected"
              ? "Token required"
              : "CLI unavailable",
    );

    const trimmedGithubToken = $derived(githubToken.trim());

    const hasGithubToken = $derived(trimmedGithubToken.length > 0);

    const isConnected = $derived(statusTone === "connected" && !!user);

    const userInitials = $derived.by(
        () =>
            user?.name
                ?.split(/[^A-Za-z0-9]+/u)
                .filter((segment) => segment.length > 0)
                .slice(0, 2)
                .map((segment) => segment[0]?.toUpperCase() ?? "")
                .join("") || "GH",
    );

    const maskedGithubToken = $derived(
        trimmedGithubToken.length <= 8
            ? trimmedGithubToken.length > 0
                ? "••••••••"
                : ""
            : `${trimmedGithubToken.slice(0, 4)}••••${trimmedGithubToken.slice(-4)}`,
    );
</script>

<section class="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
    <Card.Root class="border-border/60 bg-card/85 backdrop-blur-xl">
        <Card.Header class="space-y-5 px-8 pb-0 pt-8">
            <div class="flex items-center justify-between gap-3">
                <Badge.Badge
                    variant="outline"
                    class="rounded-full px-3 py-1 text-xs font-medium"
                >
                    <BrandGithubIcon class="size-3.5" />
                    GitHub only
                </Badge.Badge>
                <Badge.Badge
                    variant="outline"
                    class="rounded-full px-3 py-1 text-xs font-medium"
                >
                    {statusLabel}
                </Badge.Badge>
            </div>

            <div class="space-y-3">
                <Card.Title
                    class="text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                    Connect Mission to GitHub
                </Card.Title>
                <Card.Description
                    class="max-w-xl text-base leading-7 text-muted-foreground"
                >
                    Use a GitHub personal access token to unlock Mission’s
                    daemon-backed repository workflows. The token is attached
                    per request, stays out of daemon session state, and is
                    stored only in an HTTP-only cookie.
                </Card.Description>
            </div>
        </Card.Header>

        <Card.Content class="grid gap-6 px-8 pb-8 pt-6">
            <div class="grid gap-4 sm:grid-cols-3">
                <div class="rounded-2xl border bg-background/70 p-4">
                    <ShieldHalfIcon class="mb-3 size-5 text-primary" />
                    <p class="font-medium">Stateless by default</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Mission injects GitHub auth into each daemon command
                        envelope instead of caching a daemon session.
                    </p>
                </div>
                <div class="rounded-2xl border bg-background/70 p-4">
                    <KeyIcon class="mb-3 size-5 text-primary" />
                    <p class="font-medium">GitHub-only access</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                        The current login flow is intentionally scoped to GitHub
                        so repository workflows stay predictable.
                    </p>
                </div>
                <div class="rounded-2xl border bg-background/70 p-4">
                    <SparklesIcon class="mb-3 size-5 text-primary" />
                    <p class="font-medium">Immediate validation</p>
                    <p class="mt-1 text-sm text-muted-foreground">
                        After saving, Mission tries a real daemon-backed GitHub
                        workflow so you see success right away.
                    </p>
                </div>
            </div>

            <div class="rounded-2xl border bg-muted/40 p-5">
                <p class="text-sm font-medium">What to paste</p>
                <ul class="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li class="flex items-start gap-2">
                        <CheckIcon class="mt-0.5 size-4 text-primary" />A GitHub
                        PAT or OAuth token with the repository scopes Mission
                        needs.
                    </li>
                    <li class="flex items-start gap-2">
                        <CheckIcon class="mt-0.5 size-4 text-primary" />A token
                        you would otherwise use with <code>gh auth login</code> or
                        GitHub API automation.
                    </li>
                    <li class="flex items-start gap-2">
                        <CheckIcon class="mt-0.5 size-4 text-primary" />A token
                        you can rotate anytime from GitHub settings without
                        changing Mission server code.
                    </li>
                </ul>
            </div>
        </Card.Content>
    </Card.Root>

    <Card.Root class="border-border/70 bg-card/95 backdrop-blur-xl">
        {#if isConnected && user}
            <Card.Header class="px-8 pb-0 pt-8">
                <Card.Title
                    class="flex items-center gap-3 text-2xl font-semibold"
                >
                    <BrandGithubIcon class="size-6" />
                    Connected GitHub Profile
                </Card.Title>
                <Card.Description class="pt-1 text-sm leading-6">
                    Mission is ready to use this account for authenticated
                    requests.
                </Card.Description>
            </Card.Header>

            <Card.Content class="space-y-6 px-8 pt-6">
                <div class="rounded-3xl border bg-background/80 p-6">
                    <div class="flex flex-col items-center text-center">
                        <Avatar.Root
                            class="h-48 w-48 max-w-none overflow-hidden rounded-[2.5rem] shadow-sm"
                        >
                            <Avatar.Image
                                src={user.avatarUrl}
                                alt={user.name}
                            />
                            <Avatar.Fallback class="rounded-[2.5rem] text-6xl">
                                {userInitials}
                            </Avatar.Fallback>
                        </Avatar.Root>
                        <div class="mt-5 space-y-2">
                            <p class="text-2xl font-semibold tracking-tight">
                                {user.name}
                            </p>
                        </div>
                        {#if user.email}
                            <div
                                class="mt-5 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
                            >
                                <MailIcon class="size-4" />
                                {user.email}
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="rounded-2xl border bg-background/70 p-4">
                    <p
                        class:text-muted-foreground={probe.status === "idle"}
                        class:text-emerald-600={probe.status === "success"}
                        class:text-destructive={probe.status === "error"}
                        class="text-sm"
                    >
                        {probe.message}
                    </p>
                </div>

                <div class="space-y-3">
                    <Button
                        href={redirectTo}
                        size="lg"
                        class="w-full rounded-2xl"
                    >
                        Continue to Mission
                        <ArrowRightIcon class="size-4" />
                    </Button>

                    <form
                        method="POST"
                        action="?/clearGithubToken"
                        class="w-full"
                    >
                        <input
                            type="hidden"
                            name="redirect_to"
                            value={redirectTo}
                        />
                        <Button
                            type="submit"
                            variant="outline"
                            size="lg"
                            class="w-full rounded-2xl"
                        >
                            Clear saved token
                        </Button>
                    </form>
                </div>
            </Card.Content>
        {:else}
            <Card.Header class="px-8 pb-0 pt-8">
                <Card.Title
                    class="flex items-center gap-3 text-2xl font-semibold"
                >
                    <BrandGithubIcon class="size-6" />
                    Sign in with GitHub
                </Card.Title>
                <Card.Description class="pt-1 text-sm leading-6">
                    Paste your token once and Mission will attach it to
                    authenticated daemon requests on the server.
                </Card.Description>
            </Card.Header>

            <Card.Content class="space-y-5 px-8 pt-6">
                <form
                    method="POST"
                    action="?/saveGithubToken"
                    class="space-y-4"
                >
                    <input
                        type="hidden"
                        name="redirect_to"
                        value={redirectTo}
                    />
                    <div class="space-y-2">
                        <Label for="github-token">GitHub token</Label>
                        <Input
                            id="github-token"
                            name="auth_token"
                            type="password"
                            bind:value={githubToken}
                            placeholder="ghp_..."
                            autocomplete="off"
                            class="h-11 rounded-2xl"
                        />
                        <p class="text-xs text-muted-foreground">
                            Mission stores the token in an HTTP-only cookie and
                            forwards it per daemon command.
                        </p>
                    </div>

                    {#if hasGithubToken}
                        <div
                            class="rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                        >
                            Pending token: <span
                                class="font-medium text-foreground"
                                >{maskedGithubToken}</span
                            >
                        </div>
                    {/if}

                    {#if error}
                        <div
                            class="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                        >
                            {error}
                        </div>
                    {/if}

                    <div class="space-y-3">
                        <Button
                            type="submit"
                            size="lg"
                            class="w-full rounded-2xl"
                            disabled={!hasGithubToken}
                        >
                            <BrandGithubIcon class="size-4" />
                            Continue with GitHub
                            <ArrowRightIcon class="size-4" />
                        </Button>

                        <Button
                            type="submit"
                            formaction="?/clearGithubToken"
                            variant="outline"
                            size="lg"
                            class="w-full rounded-2xl"
                            onclick={() => {
                                githubToken = "";
                            }}
                        >
                            Clear saved token
                        </Button>
                    </div>
                </form>

                <div class="rounded-2xl border bg-background/70 p-4">
                    <p class="text-sm font-medium">Current status</p>
                    <p
                        class:text-muted-foreground={probe.status === "idle"}
                        class:text-emerald-600={probe.status === "success"}
                        class:text-destructive={probe.status === "error"}
                        class="mt-2 text-sm"
                    >
                        {probe.message}
                    </p>
                </div>
            </Card.Content>
        {/if}
    </Card.Root>
</section>
