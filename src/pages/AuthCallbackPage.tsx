import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    // supabase-js auto-detects the token in the URL and sets the session.
    // We just wait for the session to appear, then redirect.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/', { replace: true });
      } else {
        // Sometimes the session lands a tick later via onAuthStateChange.
        const { data: { subscription } } =
          supabase.auth.onAuthStateChange((_evt, session) => {
            if (session) {
              subscription.unsubscribe();
              navigate('/', { replace: true });
            }
          });
        // After 10s with no session, surface an error.
        setTimeout(() => {
          setMessage('Sign-in link is invalid or expired. Please request a new one.');
        }, 10_000);
      }
    });
  }, [navigate]);

  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
