import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/', { replace: true });
      } else {
        const { data: { subscription } } =
          supabase.auth.onAuthStateChange((_evt, session) => {
            if (session) {
              subscription.unsubscribe();
              navigate('/', { replace: true });
            }
          });
        setTimeout(() => {
          setMessage('Sign-in link is invalid or expired. Please request a new one.');
        }, 10_000);
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-4">
      <p className="text-sm text-neutral-100">{message}</p>
    </div>
  );
}
