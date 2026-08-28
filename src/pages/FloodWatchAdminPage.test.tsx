import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const authState = {
  isAdmin: false,
  loading: false,
  user: null as { id: string } | null,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/auth-context', () => ({
  useAuthContext: () => authState,
}));

vi.mock('@/lib/flood-queries', () => ({
  getPendingFloodReports: vi.fn(() => Promise.resolve([])),
  getAllFloodReports: vi.fn(() => Promise.resolve([])),
}));

import FloodWatchAdminPage from './FloodWatchAdminPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <FloodWatchAdminPage />
    </MemoryRouter>,
  );

describe('FloodWatchAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAdmin = false;
    authState.user = null;
  });

  it('offers the login link when signed out', () => {
    renderPage();
    const link = screen.getByRole('link', { name: 'FloodWatch.login' });
    expect(link).toHaveAttribute('href', '/floodwatch/login');
  });

  it('offers a working logout when signed in but not an admin', () => {
    authState.user = { id: 'uid-9' };
    renderPage();
    expect(screen.getByText('FloodWatch.adminRequired')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(authState.logout).toHaveBeenCalled();
  });

  it('renders the moderation queue with a working logout button for admins', async () => {
    authState.isAdmin = true;
    authState.user = { id: 'uid-1' };
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('FloodWatch.noPending')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Invite admin' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(authState.logout).toHaveBeenCalled();
  });
});
