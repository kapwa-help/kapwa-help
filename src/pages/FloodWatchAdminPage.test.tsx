import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-context', () => ({
  useAuthContext: () => ({ isAdmin: true, loading: false }),
}));

vi.mock('@/lib/flood-queries', () => ({
  getPendingFloodReports: vi.fn(() => Promise.resolve([])),
  getAllFloodReports: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import FloodWatchAdminPage from './FloodWatchAdminPage';

describe('FloodWatchAdminPage', () => {
  it('opens the admin invitation form from the Flood Watch header', async () => {
    render(<FloodWatchAdminPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Invite admin' }));

    expect(
      screen.getByRole('heading', { name: 'Invite admin' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('App.loading')).not.toBeInTheDocument(),
    );
  });
});
