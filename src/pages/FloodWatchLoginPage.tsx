import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthContext } from '@/lib/auth-context';
import { floodPath } from '@/lib/flood-host';

export default function FloodWatchLoginPage() {
  const { login } = useAuthContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    const { error } = await login(email.trim(), password);
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      navigate(floodPath('/admin'), { replace: true });
    }
  };

  return (
    <div className="min-h-dvh bg-base px-4 py-16">
      <div className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
        <form onSubmit={onSubmit} className="space-y-4">
          <h1 className="text-xl font-semibold text-neutral-50">Flood Watch admin sign-in</h1>
          <p className="text-sm text-neutral-100">
            Sign in with the email and password you were given. Contact the site owner if
            you need access.
          </p>
          <label className="block text-sm text-neutral-100">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400"
            />
          </label>
          <label className="block text-sm text-neutral-100">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-50 transition-colors"
          >
            {status === 'submitting' ? 'Signing in…' : 'Sign in'}
          </button>
          {status === 'error' && <p className="text-sm text-error">{errorMsg}</p>}
        </form>
      </div>
    </div>
  );
}
