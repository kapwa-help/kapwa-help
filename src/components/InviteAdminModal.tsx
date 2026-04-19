import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function InviteAdminModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!open) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    const { data, error } = await supabase.functions.invoke('invite-admin', {
      body: { email: email.trim(), display_name: displayName.trim() },
    });
    if (error || (data as any)?.error) {
      setStatus('error');
      setErrorMsg(error?.message ?? (data as any)?.error ?? 'Unknown error');
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
        <h2 className="text-lg font-semibold text-neutral-50">Invite admin</h2>
        {status === 'sent' ? (
          <>
            <p className="text-sm text-neutral-100">Invite sent to {email}.</p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80 transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400"
            />
            <input
              type="text"
              placeholder="display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-neutral-400/20 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-400/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-50 transition-colors"
              >
                {status === 'sending' ? 'Sending…' : 'Send invite'}
              </button>
            </div>
            {status === 'error' && <p className="text-sm text-error">{errorMsg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
