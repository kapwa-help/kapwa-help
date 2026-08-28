import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const login = vi.fn();
const navigate = vi.fn();

vi.mock('@/lib/auth-context', () => ({
  useAuthContext: () => ({ login, user: null, isAdmin: false, loading: false, logout: vi.fn() }),
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

import FloodWatchLoginPage from './FloodWatchLoginPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <FloodWatchLoginPage />
    </MemoryRouter>,
  );

describe('FloodWatchLoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits trimmed email + password and navigates to the admin page', async () => {
    login.mockResolvedValue({ error: null });
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' h@up.edu.ph ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith('h@up.edu.ph', 'secret123'),
    );
    // jsdom host is localhost, so the non-subdomain path is expected.
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/floodwatch/admin', { replace: true }),
    );
  });

  it('shows the error message when sign-in fails', async () => {
    login.mockResolvedValue({ error: new Error('Invalid login credentials') });
    renderPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'h@up.edu.ph' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
