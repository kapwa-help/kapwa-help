import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    })),
  },
}));
vi.mock('../lib/auth-mode', () => ({ AUTH_MODE: 'open' }));

import { useAuth } from './use-auth';

describe('useAuth (open mode)', () => {
  it('isAdmin=true even with no session', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });
});
