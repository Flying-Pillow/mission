// /apps/airport/web/src/lib/context/app-context.svelte.ts: App-wide client context helpers for mission route data.
import { getContext, setContext } from "svelte";

export type GithubStatus = "connected" | "disconnected" | "unknown";

export type AppContextValue = {
    daemon: {
        running: boolean;
        startedByHook: boolean;
        message: string;
        endpointPath?: string;
        lastCheckedAt: string;
    };
    githubStatus: GithubStatus;
    user?: {
        name: string;
        email?: string;
        avatarUrl?: string;
        githubStatus: GithubStatus;
    };
};

export type AppContextGetter = () => AppContextValue;

const APP_CONTEXT_KEY = Symbol("mission-app-context");

export function setAppContext(context: AppContextGetter): AppContextGetter {
    setContext(APP_CONTEXT_KEY, context);
    return context;
}

export function getAppContext(): AppContextGetter | undefined {
    try {
        return getContext<AppContextGetter>(APP_CONTEXT_KEY);
    } catch {
        return undefined;
    }
}