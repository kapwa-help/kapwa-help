import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));
vi.mock('../lib/auth-mode', () => ({ AUTH_MODE: 'strict' }));

import { supabase } from '../lib/supabase';
import { useAuth } from './use-auth';

const mockNoAdminRow = () => {
  (supabase.from as any).mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    }),
  });
};

const mockAdminRow = (userId: string) => {
  (supabase.from as any).mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { user_id: userId }, error: null }),
      }),
    }),
  });
};

describe('useAuth (strict mode)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isAdmin=false and user=null when no session', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
    mockNoAdminRow();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('isAdmin=true when authenticated user has admin_users row', async () => {
    const user = { id: 'uid-1', email: 'admin@example.com' };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user } } });
    mockAdminRow('uid-1');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user).toEqual(user);
  });

  it('isAdmin=false when authenticated user has no admin_users row', async () => {
    const user = { id: 'uid-2', email: 'viewer@example.com' };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user } } });
    mockNoAdminRow();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });
});
