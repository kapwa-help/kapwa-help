import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    const destination = searchParams.get('returnTo') || '/demo/en';

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate(destination, { replace: true });
      } else {
        const { data: { subscription } } =
          supabase.auth.onAuthStateChange((_evt, session) => {
            if (session) {
              subscription.unsubscribe();
              navigate(destination, { replace: true });
            }
          });
        setTimeout(() => {
          setMessage('Sign-in link is invalid or expired. Please request a new one.');
        }, 10_000);
      }
    });
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-4">
      <p className="text-sm text-neutral-100">{message}</p>
    </div>
  );
}
