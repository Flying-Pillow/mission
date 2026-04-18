// /apps/airport/web/src/routes/+page.server.ts: Loads the Airport landing page data, including live daemon and tower projection status.
import { DaemonApi } from '@flying-pillow/mission-core';
import { redirect, type Actions } from '@sveltejs/kit';
import { connectAuthenticatedDaemonClient } from '$lib/server/daemon.server';
import { clearGithubAuthTokenCookie } from '$lib/server/github-auth.server';
import type { PageServerLoad } from './$types';

export const prerender = false;


export const load: PageServerLoad = async ({ locals }) => {
    let towerProjection: Awaited<ReturnType<DaemonApi['airport']['getStatus']>>['airportProjections']['tower'] | undefined;

    try {
        const daemon = await connectAuthenticatedDaemonClient({ locals });
        try {
            const api = new DaemonApi(daemon.client);
            towerProjection = (await api.airport.getStatus()).airportProjections.tower;
        } finally {
            daemon.dispose();
        }
    } catch {
        towerProjection = undefined;
    }

    return {
        loginHref: '/login?redirectTo=/',
        ...(towerProjection ? { towerProjection } : {})
    };
};

export const actions: Actions = {
    logout: async ({ cookies, locals }) => {
        clearGithubAuthTokenCookie(cookies);
        locals.githubAuthToken = undefined;
        throw redirect(303, '/');
    }
};