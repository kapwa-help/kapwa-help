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

  if (status === 'sent') {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold mb-2">Check your email</h1>
        <p className="text-sm text-gray-600">
          We sent a magic link to <span className="font-medium">{email}</span>. Click it to sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Admin sign-in</h1>
      <p className="text-sm text-gray-600">
        Enter your email to receive a one-time login link. Only invited admins can sign in.
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full border rounded px-3 py-2"
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-blue-600 text-white rounded px-3 py-2 disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}
    </form>
  );
}
