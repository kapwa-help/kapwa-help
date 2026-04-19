export type AuthMode = 'open' | 'strict';

const raw = import.meta.env.VITE_AUTH_MODE as string | undefined;

export const AUTH_MODE: AuthMode = raw === 'strict' ? 'strict' : 'open';
