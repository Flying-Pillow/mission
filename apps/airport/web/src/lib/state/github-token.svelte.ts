export const githubAuthState = $state({
    token: ''
});

export const githubAuthDerived = {
    get hasToken(): boolean {
        return githubAuthState.token.trim().length > 0;
    },
    get maskedToken(): string {
        const trimmed = githubAuthState.token.trim();
        if (trimmed.length <= 8) {
            return trimmed.length > 0 ? '••••••••' : '';
        }

        return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
    }
};

export function setGithubAuthToken(token: string): void {
    githubAuthState.token = token;
}

export function clearGithubAuthToken(): void {
    githubAuthState.token = '';
}