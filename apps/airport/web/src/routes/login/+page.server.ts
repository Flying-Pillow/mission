import { readSystemStatus } from '@flying-pillow/mission-core';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import {
    clearGithubAuthTokenCookie,
    writeGithubAuthToken
} from '$lib/server/github-auth.server';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.githubAuthToken) {
        return {
            redirectTo: resolveRedirectTarget(url.searchParams.get('redirectTo')),
            githubProbe: {
                status: 'idle' as const,
                message: 'Connect GitHub to unlock daemon-backed repository workflows.'
            }
        };
    }

    return {
        redirectTo: resolveRedirectTarget(url.searchParams.get('redirectTo')),
        githubProbe: {
            status: 'success' as const,
            message: 'GitHub is connected. Mission will attach this account to authenticated requests.'
        }
    };
};

export const actions: Actions = {
    saveGithubToken: async ({ cookies, locals, request, url }) => {
        const formData = await request.formData();
        const authToken = String(formData.get('auth_token') ?? '').trim();
        const redirectTo = resolveRedirectTarget(String(formData.get('redirect_to') ?? '') || url.searchParams.get('redirectTo'));

        if (!authToken) {
            return fail(400, {
                githubAuth: {
                    error: 'GitHub token is required.'
                }
            });
        }

        const systemStatus = readSystemStatus({
            cwd: process.cwd(),
            authToken
        });
        if (!systemStatus.github.authenticated) {
            return fail(400, {
                githubAuth: {
                    error: systemStatus.github.detail ?? 'GitHub token validation failed.'
                }
            });
        }

        writeGithubAuthToken(cookies, authToken);
        locals.githubAuthToken = authToken;
        throw redirect(303, redirectTo);
    },
    clearGithubToken: async ({ cookies, locals, request, url }) => {
        const formData = await request.formData();
        const redirectTo = resolveRedirectTarget(String(formData.get('redirect_to') ?? '') || url.searchParams.get('redirectTo'));

        clearGithubAuthTokenCookie(cookies);
        locals.githubAuthToken = undefined;
        throw redirect(303, redirectTo === '/login' ? '/login' : redirectTo);
    }
};

function resolveRedirectTarget(candidate: string | null | undefined): string {
    const value = candidate?.trim();
    if (!value || !value.startsWith('/')) {
        return '/';
    }
    if (value.startsWith('//')) {
        return '/';
    }
    return value;
}