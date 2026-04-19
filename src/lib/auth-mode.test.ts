import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AUTH_MODE', () => {
  beforeEach(() => vi.resetModules());

  it('returns "open" when VITE_AUTH_MODE is "open"', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'open');
    const { AUTH_MODE } = await import('./auth-mode');
    expect(AUTH_MODE).toBe('open');
  });

  it('returns "strict" when VITE_AUTH_MODE is "strict"', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'strict');
    const { AUTH_MODE } = await import('./auth-mode');
    expect(AUTH_MODE).toBe('strict');
  });

  it('defaults to "open" when unset', async () => {
    vi.stubEnv('VITE_AUTH_MODE', '');
    const { AUTH_MODE } = await import('./auth-mode');
    expect(AUTH_MODE).toBe('open');
  });
});
