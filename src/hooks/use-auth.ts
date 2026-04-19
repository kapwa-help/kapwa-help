import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AUTH_MODE } from '../lib/auth-mode';

export type UseAuthState = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
};

export function useAuth(): UseAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminRow, setIsAdminRow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const handle = async (session: Session | null) => {
      const nextUser = session?.user ?? null;
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', nextUser.id)
          .maybeSingle();
        if (!active) return;
        setIsAdminRow(Boolean(data));
      } else {
        setIsAdminRow(false);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => handle(data.session));
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_evt, session) => handle(session));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = AUTH_MODE === 'open' ? true : isAdminRow;

  return { user, isAdmin, loading, login, logout };
}
