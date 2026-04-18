import type { Cookies } from '@sveltejs/kit';

export const GITHUB_AUTH_COOKIE_NAME = 'mission_github_auth_token';

export function readGithubAuthToken(cookies: Cookies): string | undefined {
    const token = cookies.get(GITHUB_AUTH_COOKIE_NAME)?.trim();
    return token && token.length > 0 ? token : undefined;
}

export function writeGithubAuthToken(cookies: Cookies, authToken: string): void {
    cookies.set(GITHUB_AUTH_COOKIE_NAME, authToken.trim(), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env['NODE_ENV'] === 'production',
        maxAge: 60 * 60 * 24 * 30
    });
}

export function clearGithubAuthTokenCookie(cookies: Cookies): void {
    cookies.delete(GITHUB_AUTH_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env['NODE_ENV'] === 'production'
    });
}