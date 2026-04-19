import { useState, type FormEvent } from 'react';
import { useAuthContext } from '../lib/auth-context';

export function LoginPage() {
  const { login } = useAuthContext();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    const { error } = await login(email.trim());
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="min-h-dvh bg-base px-4 py-16">
      <div className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
        {status === 'sent' ? (
          <>
            <h1 className="text-xl font-semibold text-neutral-50">Check your email</h1>
            <p className="text-sm text-neutral-100">
              We sent a magic link to{' '}
              <span className="font-medium text-neutral-50">{email}</span>. Click it to sign in.
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-xl font-semibold text-neutral-50">Admin sign-in</h1>
            <p className="text-sm text-neutral-100">
              Enter your email to receive a one-time login link. Only invited admins can sign in.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-50 transition-colors"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {status === 'error' && <p className="text-sm text-error">{errorMsg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
