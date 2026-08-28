import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UseAuthState = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
};

export function useAuth(): UseAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
        setIsAdmin(Boolean(data));
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => handle(data.session))
      .catch(() => {
        if (active) setLoading(false);
      });
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_evt, session) => {
        // Supabase invokes auth listeners while holding an exclusive lock.
        // Defer database work until the listener returns so it cannot deadlock
        // while trying to read the current session for the request.
        setTimeout(() => void handle(session), 0);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return { user, isAdmin, loading, login, logout };
}
