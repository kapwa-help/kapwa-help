import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteAdminModal } from './InviteAdminModal';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: 'jwt-123' } } })
      ),
    },
    functions: { invoke: vi.fn() },
  },
}));

import { supabase } from '../lib/supabase';

describe('InviteAdminModal', () => {
  it('calls invite-admin edge function with email', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({ data: { ok: true }, error: null });
    render(<InviteAdminModal open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() =>
      expect(supabase.functions.invoke).toHaveBeenCalledWith('invite-admin', {
        body: { email: 'new@example.com', display_name: '' },
      })
    );
  });

  it('shows error when invite fails', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: { message: 'email_already_exists' },
    });
    render(<InviteAdminModal open onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'dup@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => expect(screen.getByText(/email_already_exists/)).toBeInTheDocument());
  });
});
