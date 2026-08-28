# Flood Watch Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace magic-link auth with email+password login scoped to Flood Watch only, make `floodwatch.kapwahelp.org` the canonical home, and delete the invite/AUTH_MODE machinery.

**Architecture:** Auth method changes (`signInWithPassword`); the authorization gate (`admin_users` row + RLS `is_admin()`) is untouched. Routing becomes host-aware: clean paths (`/`, `/admin`, `/login`) on the flood subdomain, `/floodwatch*` paths everywhere else. Demo relief pages lose all auth code (permanently ungated — matches today's deployed open-mode behavior). Admin provisioning becomes a service-role script.

**Tech Stack:** Vite + React SPA, react-router v7 (`createBrowserRouter`), Supabase JS v2, Vitest + RTL, Playwright, Vercel hosting.

**Spec:** `docs/superpowers/specs/2026-08-28-floodwatch-password-auth-spec.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/flood-host.ts` | Create | Host detection + host-aware path helper |
| `src/lib/flood-host.test.ts` | Create | Unit tests for `floodPath` |
| `src/hooks/use-auth.ts` | Rewrite | Password login; drop AUTH_MODE branches |
| `src/hooks/use-auth.test.tsx` | Rewrite | Password-login coverage; keep deadlock test |
| `src/hooks/use-auth-open.test.tsx` | Delete | Open mode no longer exists |
| `src/pages/FloodWatchLoginPage.tsx` | Create | Email+password form (hardcoded English) |
| `src/pages/FloodWatchLoginPage.test.tsx` | Create | Form behavior tests |
| `src/pages/LoginPage.tsx` | Delete | Replaced by FloodWatchLoginPage |
| `src/pages/AuthCallbackPage.tsx` | Delete | Route becomes a redirect |
| `src/router.tsx` | Rewrite | Host-aware routes + legacy redirects |
| `src/main.tsx` | Modify | AuthProvider scoping moves to router (Task 7) |
| `src/pages/FloodWatchAdminPage.tsx` | Modify | Drop invite UI; add logout; Link to login |
| `src/pages/FloodWatchAdminPage.test.tsx` | Rewrite | Admin/non-admin states, no invite |
| `src/components/Header.tsx` | Modify | Drop invite UI + all auth imports |
| `src/components/InviteAdminModal.tsx` + `.test.tsx` | Delete | Invite flow gone |
| `src/lib/auth-mode.ts` + `.test.ts` | Delete | Concept gone |
| `src/components/FloodReportDetail.tsx` | Modify | `AdminOnly` → `isAdmin &&` |
| `src/pages/FloodWatchPage.tsx` | Modify | Admin link via `floodPath` |
| `src/components/AdminOnly.tsx` | Delete | Demo pages ungated |
| `src/components/{ClaimForm,DonationForm,PurchaseForm,PinDetailSheet,HazardDetailPanel}.tsx` | Modify | Unwrap `AdminOnly` |
| `src/pages/ReportPage.tsx`, `src/pages/ReliefMapPage.tsx` | Modify | Drop `isAdmin` conditionals |
| `src/lib/queries.ts` | Modify | Drop `isAdmin` param branches |
| `scripts/create-admin.ts` | Create | Manual admin provisioning |
| `scripts/bootstrap-admin.ts` | Delete | Replaced |
| `supabase/functions/invite-admin/index.ts` | Delete | Invite flow gone |
| `supabase/schema.sql` | Modify | Drop `handle_new_user` trigger definition |
| `supabase/auth-password-migration.sql` | Create | One-time live-DB cleanup |
| `vercel.json` | Modify | Host-scoped redirects to subdomain |
| `package.json` | Modify | `create:admin` script |
| `.env.example` | Modify | Drop `VITE_AUTH_MODE` |
| `.Codex/rules/auth.md`, `.claude/rules/supabase.md` | Modify | Document new auth |

Task order keeps the build green after every task: flood-host → use-auth → login page → router → admin page/Header → flood components → demo cleanup → script/SQL → vercel/docs → verification.

---

### Task 1: `flood-host` helper

**Files:**
- Create: `src/lib/flood-host.ts`
- Test: `src/lib/flood-host.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/flood-host.test.ts
import { describe, expect, it } from 'vitest';
import { FLOOD_WATCH_HOST, floodPath, isFloodWatchHost } from './flood-host';

describe('flood-host', () => {
  it('detects the flood watch host', () => {
    expect(isFloodWatchHost(FLOOD_WATCH_HOST)).toBe(true);
    expect(isFloodWatchHost('kapwahelp.org')).toBe(false);
    expect(isFloodWatchHost('localhost')).toBe(false);
  });

  it('returns clean paths on the subdomain', () => {
    expect(floodPath('/', FLOOD_WATCH_HOST)).toBe('/');
    expect(floodPath('/admin', FLOOD_WATCH_HOST)).toBe('/admin');
    expect(floodPath('/login', FLOOD_WATCH_HOST)).toBe('/login');
  });

  it('returns /floodwatch paths on other hosts', () => {
    expect(floodPath('/', 'kapwahelp.org')).toBe('/floodwatch');
    expect(floodPath('/admin', 'localhost')).toBe('/floodwatch/admin');
    expect(floodPath('/login', 'kapwahelp.org')).toBe('/floodwatch/login');
  });

  it('defaults to window.location.hostname (localhost in jsdom)', () => {
    expect(floodPath('/admin')).toBe('/floodwatch/admin');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/flood-host.test.ts`
Expected: FAIL — Cannot find module `./flood-host`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/flood-host.ts
export const FLOOD_WATCH_HOST = 'floodwatch.kapwahelp.org';

export function isFloodWatchHost(
  hostname: string = typeof window === 'undefined' ? '' : window.location.hostname,
): boolean {
  return hostname === FLOOD_WATCH_HOST;
}

// Flood Watch lives at clean paths on its subdomain and under /floodwatch
// everywhere else (main domain, localhost, Vercel previews).
export function floodPath(subpath: '/' | '/admin' | '/login', hostname?: string): string {
  if (isFloodWatchHost(hostname)) return subpath;
  return subpath === '/' ? '/floodwatch' : `/floodwatch${subpath}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/flood-host.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/flood-host.ts src/lib/flood-host.test.ts
git commit -m "feat(auth): add host-aware Flood Watch path helper"
```

---

### Task 2: Rewrite `use-auth` for password login

**Files:**
- Rewrite: `src/hooks/use-auth.ts`
- Rewrite: `src/hooks/use-auth.test.tsx`
- Delete: `src/hooks/use-auth-open.test.tsx`

- [ ] **Step 1: Rewrite the test file (failing first)**

Replace `src/hooks/use-auth.test.tsx` entirely with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import { useAuth } from './use-auth';

const mockNoAdminRow = () => {
  (supabase.from as any).mockReturnValue({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    }),
  });
};

const mockAdminRow = (userId: string) => {
  (supabase.from as any).mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { user_id: userId }, error: null }),
      }),
    }),
  });
};

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isAdmin=false and user=null when no session', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
    mockNoAdminRow();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('isAdmin=true when authenticated user has admin_users row', async () => {
    const user = { id: 'uid-1', email: 'admin@example.com' };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user } } });
    mockAdminRow('uid-1');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user).toEqual(user);
  });

  it('isAdmin=false when authenticated user has no admin_users row', async () => {
    const user = { id: 'uid-2', email: 'viewer@example.com' };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user } } });
    mockNoAdminRow();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('login calls signInWithPassword with the credentials', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
    (supabase.auth.signInWithPassword as any).mockResolvedValue({ error: null });
    mockNoAdminRow();
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const { error } = await result.current.login('a@b.co', 'hunter2');

    expect(error).toBeNull();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'hunter2',
    });
  });

  // Regression guard for 731ad03: Supabase runs auth listeners while holding an
  // exclusive lock; the callback must return synchronously.
  it('returns synchronously from auth state changes before checking admin access', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
    mockAdminRow('uid-3');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callback = (supabase.auth.onAuthStateChange as any).mock.calls[0][0];
    const callbackResult = callback('SIGNED_IN', {
      user: { id: 'uid-3', email: 'admin@example.com' },
    });

    expect(callbackResult).toBeUndefined();
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
  });
});
```

- [ ] **Step 2: Run tests to verify the new login test fails**

Run: `npx vitest run src/hooks/use-auth.test.tsx`
Expected: FAIL — `signInWithPassword` not called (hook still calls `signInWithOtp`)

- [ ] **Step 3: Rewrite the hook**

Replace `src/hooks/use-auth.ts` entirely with:

```ts
import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UseAuthState = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
};

export function useAuth(): UseAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const handle = async (session: Session | null) => {
      const nextUser = session?.user ?? null;
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', nextUser.id)
          .maybeSingle();
        if (!active) return;
        setIsAdmin(Boolean(data));
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => handle(data.session))
      .catch(() => {
        if (active) setLoading(false);
      });
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_evt, session) => {
        // Supabase invokes auth listeners while holding an exclusive lock.
        // Defer database work until the listener returns so it cannot deadlock
        // while trying to read the current session for the request.
        setTimeout(() => void handle(session), 0);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return { user, isAdmin, loading, login, logout };
}
```

Note: `AUTH_MODE` import, `isAdminRow` aliasing, and the open-mode `loading` shortcut are gone; `loading` now always starts `true`.

- [ ] **Step 4: Delete the open-mode test file**

```bash
git rm src/hooks/use-auth-open.test.tsx
```

- [ ] **Step 5: Run the hook tests**

Run: `npx vitest run src/hooks/use-auth.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-auth.ts src/hooks/use-auth.test.tsx
git commit -m "feat(auth): replace magic-link login with email+password"
```

Known temporary breakage (fixed in Tasks 4–5): `LoginPage.tsx` still calls `login(email)` with one argument — TypeScript will flag it. Do NOT run `npm run build` as a gate for this task; the suite gate is the hook tests.

---

### Task 3: Flood Watch login page

**Files:**
- Create: `src/pages/FloodWatchLoginPage.tsx`
- Test: `src/pages/FloodWatchLoginPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/FloodWatchLoginPage.test.tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/FloodWatchLoginPage.test.tsx`
Expected: FAIL — Cannot find module `./FloodWatchLoginPage`

- [ ] **Step 3: Write the page**

Admin-facing page: hardcoded English (same v1 convention as the old LoginPage). Card styling matches the design-system card pattern already used by the old LoginPage.

```tsx
// src/pages/FloodWatchLoginPage.tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/FloodWatchLoginPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/FloodWatchLoginPage.tsx src/pages/FloodWatchLoginPage.test.tsx
git commit -m "feat(auth): add Flood Watch password login page"
```

---

### Task 4: Host-aware router + legacy redirects

**Files:**
- Rewrite: `src/router.tsx`
- Delete: `src/pages/LoginPage.tsx`, `src/pages/AuthCallbackPage.tsx`

- [ ] **Step 1: Rewrite the router**

Replace `src/router.tsx` entirely with:

```tsx
import { createBrowserRouter, Navigate, useParams, useLocation } from "react-router";
import type { ReactNode } from "react";
import { RootLayout } from "./components/RootLayout";
import { lazyWithReload } from "@/lib/lazy-reload";
import { AuthProvider } from "@/lib/auth-context";
import { floodPath, isFloodWatchHost } from "@/lib/flood-host";
const LandingPage = lazyWithReload(() => import("./pages/LandingPage"));

const ReliefMapPage = lazyWithReload(() => import("./pages/ReliefMapPage"));
const TransparencyPage = lazyWithReload(() => import("./pages/TransparencyPage"));
const ReportPage = lazyWithReload(() => import("./pages/ReportPage"));
const FloodWatchPage = lazyWithReload(() => import("./pages/FloodWatchPage"));
const FloodWatchAdminPage = lazyWithReload(() => import("./pages/FloodWatchAdminPage"));
const FloodWatchLoginPage = lazyWithReload(() => import("./pages/FloodWatchLoginPage"));

// Only Flood Watch pages need auth; demo relief pages are public.
const withAuth = (page: ReactNode) => <AuthProvider>{page}</AuthProvider>;

// Flood Watch is served at clean paths on its subdomain and under /floodwatch
// on every other host (main domain, localhost, Vercel previews).
const floodWatchRoutes = isFloodWatchHost()
  ? [
      { path: "/", element: withAuth(<FloodWatchPage />) },
      { path: "/admin", element: withAuth(<FloodWatchAdminPage />) },
      { path: "/login", element: withAuth(<FloodWatchLoginPage />) },
      { path: "/floodwatch", element: <Navigate to="/" replace /> },
      { path: "/floodwatch/admin", element: <Navigate to="/admin" replace /> },
      { path: "/floodwatch/login", element: <Navigate to="/login" replace /> },
    ]
  : [
      { path: "/", element: <LandingPage /> },
      { path: "/floodwatch", element: withAuth(<FloodWatchPage />) },
      { path: "/floodwatch/admin", element: withAuth(<FloodWatchAdminPage />) },
      { path: "/floodwatch/login", element: withAuth(<FloodWatchLoginPage />) },
    ];

function LegacyLocaleRedirect() {
  const { locale } = useParams<{ locale: string }>();
  const { pathname, search, hash } = useLocation();
  const suffix = pathname.replace(/^\/[^/]+/, "");
  return <Navigate to={`/demo/${locale ?? "en"}${suffix}${search}${hash}`} replace />;
}

export const router = createBrowserRouter([
  ...floodWatchRoutes,
  // Old magic-link emails point here; the URL must keep working.
  { path: "/auth/callback", element: <Navigate to={floodPath("/login")} replace /> },
  {
    path: "/demo/:locale",
    element: <RootLayout />,
    children: [
      { index: true, element: <ReliefMapPage /> },
      { path: "dashboard", element: <TransparencyPage /> },
      { path: "transparency", element: <Navigate to="../dashboard" replace /> },
      { path: "report", element: <ReportPage /> },
      // Admin sign-in moved to Flood Watch; keep the old URL redirecting.
      { path: "login", element: <Navigate to={floodPath("/login")} replace /> },
    ],
  },
  {
    path: "/:locale",
    children: [
      { index: true, element: <LegacyLocaleRedirect /> },
      { path: "dashboard", element: <LegacyLocaleRedirect /> },
      { path: "transparency", element: <LegacyLocaleRedirect /> },
      { path: "report", element: <LegacyLocaleRedirect /> },
      { path: "login", element: <LegacyLocaleRedirect /> },
    ],
  },
]);
```

Notes:
- `RootRedirect` (the old flood-host check) is replaced by the host-aware route arrays.
- `main.tsx` keeps its global `AuthProvider` until Task 7 (demo components still consume the context); the nested provider is harmless — the app already double-wraps flood routes today.
- The old `/:locale/login` legacy chain still works: `/en/login` → `/demo/en/login` → flood login.

- [ ] **Step 2: Delete the replaced pages**

```bash
git rm src/pages/LoginPage.tsx src/pages/AuthCallbackPage.tsx
```

`AdminOnly.tsx`'s `redirect-to-login` fallback references `/en/login` — that redirect chain still resolves, and `AdminOnly` itself is deleted in Task 7. No other file imports `LoginPage` or `AuthCallbackPage` (only the router did).

- [ ] **Step 3: Type-check and run the full unit suite**

Run: `npm run build && npm test`
Expected: build passes (the `login(email)` single-arg call died with LoginPage.tsx); all unit tests pass except `FloodWatchAdminPage.test.tsx` MAY still pass (it mocks contexts) — if anything unrelated fails, stop and investigate before continuing.

- [ ] **Step 4: Smoke-test routes**

Run: `npm run verify`
Expected: 16/16 Playwright smoke tests pass (demo routes unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/router.tsx
git commit -m "feat(auth): host-aware Flood Watch routes; retire magic-link pages"
```

---

### Task 5: Admin page logout + remove invite machinery

**Files:**
- Modify: `src/pages/FloodWatchAdminPage.tsx`
- Rewrite: `src/pages/FloodWatchAdminPage.test.tsx`
- Modify: `src/components/Header.tsx`
- Delete: `src/components/InviteAdminModal.tsx`, `src/components/InviteAdminModal.test.tsx`, `src/lib/auth-mode.ts`, `src/lib/auth-mode.test.ts`

- [ ] **Step 1: Rewrite the admin page test (failing first)**

Replace `src/pages/FloodWatchAdminPage.test.tsx` entirely with:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
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

  it('offers logout when signed in but not an admin', () => {
    authState.user = { id: 'uid-9' };
    renderPage();
    expect(screen.getByText('FloodWatch.adminRequired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('renders the moderation queue with a logout button for admins', async () => {
    authState.isAdmin = true;
    authState.user = { id: 'uid-1' };
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('FloodWatch.noPending')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite admin' })).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/pages/FloodWatchAdminPage.test.tsx`
Expected: FAIL (invite button still present, login link is an `<a href="/demo/en/login…">`, no logout)

- [ ] **Step 2: Modify `FloodWatchAdminPage.tsx`**

- Remove the `InviteAdminModal` import, the `inviteOpen` state, the `<InviteAdminModal …/>` render, and the "Invite admin" header button.
- Add imports: `import { Link } from "react-router";` and `import { floodPath } from "@/lib/flood-host";`
- Change the context destructure to: `const { isAdmin, loading: authLoading, user, logout } = useAuthContext();`
- Replace the `!isAdmin` branch with:

```tsx
  if (!isAdmin) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-base">
        <p className="text-neutral-400">{t("FloodWatch.adminRequired")}</p>
        {user ? (
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80"
          >
            Log out
          </button>
        ) : (
          <Link
            to={floodPath("/login")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-neutral-50 hover:bg-primary/80"
          >
            {t("FloodWatch.login")}
          </Link>
        )}
      </div>
    );
  }
```

- Replace the header's invite button with a logout button:

```tsx
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-lg border border-neutral-400/20 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-50"
        >
          Log out
        </button>
```

("Log out" stays hardcoded English like the rest of the admin-facing v1 copy.)

- [ ] **Step 3: Clean `Header.tsx`**

Remove from `src/components/Header.tsx`:
- Imports of `AUTH_MODE` (`@/lib/auth-mode`), `useAuthContext` (`@/lib/auth-context`), and `InviteAdminModal`.
- The `isAdmin` destructure, `inviteOpen` state, and `showInvite` const.
- Both `{showInvite && (…)}` blocks (desktop nav and mobile nav) and the `<InviteAdminModal …/>` line.

Nothing else in Header changes.

- [ ] **Step 4: Delete dead files**

```bash
git rm src/components/InviteAdminModal.tsx src/components/InviteAdminModal.test.tsx src/lib/auth-mode.ts src/lib/auth-mode.test.ts
```

Before deleting, confirm no remaining importers: `grep -rn "auth-mode\|InviteAdminModal" src/` should only show the files being deleted.

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run src/pages/FloodWatchAdminPage.test.tsx && npm run build`
Expected: 3 tests pass; build clean.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "feat(auth): logout on Flood Watch admin; delete invite flow and AUTH_MODE"
```

---

### Task 6: Flood components use real `isAdmin`

**Files:**
- Modify: `src/components/FloodReportDetail.tsx`
- Modify: `src/pages/FloodWatchPage.tsx`

- [ ] **Step 1: `FloodReportDetail.tsx` — gate on `isAdmin` directly**

- Change the context destructure to `const { user, isAdmin } = useAuthContext();`
- Remove the `AdminOnly` import.
- In the `adminSection` definition, replace the `<AdminOnly>` wrapper: the section becomes `null` for non-admins:

```tsx
  const adminSection = isAdmin ? (
    <div className="space-y-3 border-t border-neutral-400/20 pt-4">
      {/* …existing children unchanged… */}
    </div>
  ) : null;
```

(Keep every child inside the `div` exactly as-is; only the wrapper changes.)

- [ ] **Step 2: `FloodWatchPage.tsx` — host-aware admin link**

- Add imports: `import { Link } from "react-router";` and `import { floodPath } from "@/lib/flood-host";`
- Replace the `<a href="/floodwatch/admin" …>` element with `<Link to={floodPath("/admin")} …>` (same className/title/children, closing tag `</Link>`).

Note: the `{isAdmin && (…)}` guard around this link stays — with real auth it now correctly hides the shield icon from the public.

- [ ] **Step 3: Run flood tests and build**

Run: `npx vitest run src/components src/pages && npm run build`
Expected: PASS; build clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/FloodReportDetail.tsx src/pages/FloodWatchPage.tsx
git commit -m "feat(auth): flood components gate on real admin status"
```

---

### Task 7: Ungate demo relief pages, delete `AdminOnly`

**Files:**
- Modify: `src/components/ClaimForm.tsx`, `src/components/DonationForm.tsx`, `src/components/PurchaseForm.tsx`, `src/components/PinDetailSheet.tsx`, `src/components/HazardDetailPanel.tsx`, `src/pages/ReportPage.tsx`, `src/pages/ReliefMapPage.tsx`, `src/lib/queries.ts`, `src/main.tsx`
- Delete: `src/components/AdminOnly.tsx`

This restores the demo pages to exactly their deployed open-mode behavior, with the auth code removed instead of short-circuited.

- [ ] **Step 1: Unwrap `AdminOnly` in the five components**

In `ClaimForm.tsx`, `DonationForm.tsx`, `PurchaseForm.tsx`, `PinDetailSheet.tsx`, `HazardDetailPanel.tsx`:
- Delete the `import { AdminOnly } from "@/components/AdminOnly";` line.
- Replace every `<AdminOnly>` / `</AdminOnly>` pair with nothing, keeping the children (un-indent one level). Where `<AdminOnly>` was the component's root return element, the children become the root.

- [ ] **Step 2: `ReportPage.tsx` — all form options for everyone**

- Delete the `AdminOnly` and `useAuthContext` imports and the `const { isAdmin } = useAuthContext();` line.
- Replace the `visibleFormOptions` filter with direct use of `formOptions` (delete the `visibleFormOptions` const, update its usage site(s) to `formOptions`).
- Unwrap the two `<AdminOnly>` blocks around `<DonationForm />` and `<PurchaseForm />`:

```tsx
            {formType === "donation" && <DonationForm />}
            {formType === "purchase" && <PurchaseForm />}
```

- [ ] **Step 3: `ReliefMapPage.tsx` + `queries.ts` — drop the `isAdmin` parameter**

- `ReliefMapPage.tsx`: delete the `useAuthContext` import and `const { isAdmin } = useAuthContext();`; call `getNeedsMapPoints(activeEvent.id)` and `getHazards(activeEvent.id)`; remove `isAdmin` from the `useCallback` dependency array.
- `queries.ts`: in `getNeedsMapPoints` (around line 148) and `getHazards` (around line 309), remove the `isAdmin: boolean` parameter and the `isAdmin ? … : …` branches, keeping the admin branch (base tables `needs` / `hazards`, full field list). Delete the now-unused `needs_public` / `hazards_public` source strings from these functions. Grep for other callers first: `grep -rn "getNeedsMapPoints\|getHazards" src/` — update every call site.

Rationale: the deployed site runs open mode (`isAdmin=true`), so the base-table branch is the behavior in production today; the `_public`-view branch was only reachable in the never-deployed strict mode.

- [ ] **Step 4: Delete `AdminOnly` and unscope the global provider**

```bash
git rm src/components/AdminOnly.tsx
```

In `src/main.tsx`: remove the `AuthProvider` import and the `<AuthProvider>` wrapper (keep `<Suspense>` and children as-is). Flood routes get their provider from the router (Task 4).

Confirm nothing else consumes auth outside flood pages: `grep -rn "useAuthContext\|AuthProvider" src/ | grep -v test` should list only `auth-context.tsx`, `router.tsx`, `FloodWatchPage.tsx`, `FloodWatchAdminPage.tsx`, `FloodWatchLoginPage.tsx`, `FloodReportDetail.tsx`.

- [ ] **Step 5: Full unit suite + build + smoke tests**

Run: `npm test && npm run build && npm run verify`
Expected: all unit tests pass; build clean; 16/16 smoke tests pass (this is the gate that proves the demo pages didn't regress).

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "refactor: remove auth gating from demo relief pages"
```

---

### Task 8: Provisioning script + SQL cleanup

**Files:**
- Create: `scripts/create-admin.ts`
- Delete: `scripts/bootstrap-admin.ts`, `supabase/functions/invite-admin/index.ts` (and its directory)
- Create: `supabase/auth-password-migration.sql`
- Modify: `supabase/schema.sql`, `package.json`, `.env.example`

- [ ] **Step 1: Write `scripts/create-admin.ts`**

```ts
// Create (or reset the password of) a Flood Watch admin. Idempotent.
// Usage:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… [ADMIN_NAME=…] npm run create:admin
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_NAME ?? null;

if (!url || !serviceKey || !email || !password) {
  console.error(
    'Missing env. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD. Optional: ADMIN_NAME.',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey);

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error('listUsers failed:', listErr.message);
  process.exit(1);
}
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

let userId: string;
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (error) {
    console.error('Password update failed:', error.message);
    process.exit(1);
  }
  userId = existing.id;
  console.log(`Updated password for existing user ${userId}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) {
    console.error('User creation failed:', error?.message ?? 'no user returned');
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Created user ${userId}`);
}

// Upsert the admin row directly — no trigger involved (the invite-era trigger
// was unreliable and is dropped by supabase/auth-password-migration.sql).
const { error: upsertErr } = await admin.from('admin_users').upsert(
  { user_id: userId, email, display_name: displayName },
  { onConflict: 'user_id' },
);
if (upsertErr) {
  console.error('admin_users upsert failed:', upsertErr.message);
  process.exit(1);
}
console.log(`✔ ${email} can now sign in at the Flood Watch login page.`);
```

- [ ] **Step 2: Wire up package.json and delete the old script**

In `package.json` scripts, replace `"bootstrap:admin": "tsx scripts/bootstrap-admin.ts"` with `"create:admin": "tsx scripts/create-admin.ts"`.

```bash
git rm scripts/bootstrap-admin.ts
git rm -r supabase/functions/invite-admin
```

- [ ] **Step 3: Remove the trigger from `supabase/schema.sql`**

Delete the `handle_new_user` block: the comment block referencing it (around line 28), the `CREATE OR REPLACE FUNCTION handle_new_user()…` function (starts around line 43), and the `CREATE TRIGGER on_auth_user_created … EXECUTE FUNCTION handle_new_user();` statement (around lines 61–63). Keep the `admin_users` table definition unchanged.

- [ ] **Step 4: Write the live-DB migration**

```sql
-- supabase/auth-password-migration.sql
-- One-time cleanup after the 2026-08-28 password-auth redesign.
-- Run against the live project (SQL editor or: supabase db query --linked -f supabase/auth-password-migration.sql)
-- Admin rows are now created by scripts/create-admin.ts; the invite-era
-- trigger is unreliable (fires before invite metadata exists) and unused.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
```

- [ ] **Step 5: Drop `VITE_AUTH_MODE` from `.env.example`**

Delete these lines from `.env.example`:

```
# Auth mode: 'open' (demo — no login UI, isAdmin always true)
#           or 'strict' (prod — login required, isAdmin from admin_users table)
VITE_AUTH_MODE=open
```

- [ ] **Step 6: Verify and commit**

Run: `npm run build && npm run lint`
Expected: clean (script is type-checked by tsx at runtime, not by the app build; lint covers it).

```bash
git add -A
git commit -m "feat(auth): add create-admin script; retire invite function and trigger"
```

---

### Task 9: Vercel host redirects to the subdomain

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add host-scoped redirects**

Replace `vercel.json` with:

```json
{
  "redirects": [
    {
      "source": "/floodwatch",
      "has": [{ "type": "host", "value": "kapwahelp.org" }],
      "destination": "https://floodwatch.kapwahelp.org/",
      "permanent": true
    },
    {
      "source": "/floodwatch/:path*",
      "has": [{ "type": "host", "value": "kapwahelp.org" }],
      "destination": "https://floodwatch.kapwahelp.org/:path*",
      "permanent": true
    },
    {
      "source": "/floodwatch",
      "has": [{ "type": "host", "value": "www.kapwahelp.org" }],
      "destination": "https://floodwatch.kapwahelp.org/",
      "permanent": true
    },
    {
      "source": "/floodwatch/:path*",
      "has": [{ "type": "host", "value": "www.kapwahelp.org" }],
      "destination": "https://floodwatch.kapwahelp.org/:path*",
      "permanent": true
    }
  ],
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Host-scoping matters: without `has`, `/floodwatch` on the subdomain itself or on preview deployments would redirect too. Preview/localhost keep the client-side `/floodwatch*` routes.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: redirect main-domain /floodwatch URLs to the subdomain"
```

---

### Task 10: Update docs and rules

**Files:**
- Rewrite: `.Codex/rules/auth.md`
- Modify: `.claude/rules/supabase.md`

- [ ] **Step 1: Rewrite `.Codex/rules/auth.md`**

```markdown
---
paths:
  - "src/hooks/use-auth.ts"
  - "src/pages/FloodWatchLoginPage.tsx"
  - "src/lib/flood-host.ts"
  - "vite.config.ts"
---

# Authentication

- Admin auth is email+password (`signInWithPassword`), used only by Flood Watch
  (`/login` on floodwatch.kapwahelp.org, `/floodwatch/login` elsewhere). There is no
  magic-link, invite, or AUTH_MODE flow — do not reintroduce email-based login links;
  institutional mail scanners consume single-use tokens (this failed repeatedly in
  Aug 2026).
- Admin = row in `admin_users` (checked client-side for UI, enforced by RLS
  `is_admin()`). Provision admins manually with `npm run create:admin`.
- Keep `onAuthStateChange` callbacks synchronous. Supabase runs them while holding an
  exclusive auth lock, so defer database or other Supabase calls until a later task to
  avoid cross-tab deadlocks.
- Never add Supabase URLs to Workbox runtime caching. Auth and REST responses vary by
  bearer token, while Cache Storage keys requests by URL rather than authorization state.
```

- [ ] **Step 2: Update `.claude/rules/supabase.md`**

Replace the **Admin gate** bullet in the RLS Policies section with:

```markdown
- **Admin gate**: presence of a row in `admin_users` keyed by `auth.uid()`. Rows are
  created manually via `npm run create:admin` (service-role script — creates the user
  with a password and upserts the admin row). Sign-in is email+password on the Flood
  Watch login page; there is no invite flow or magic-link auth.
```

- [ ] **Step 3: Commit**

```bash
git add .Codex/rules/auth.md .claude/rules/supabase.md
git commit -m "docs: describe password-based Flood Watch auth"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full automated suite**

Run: `npm test && npm run lint && npm run build && npm run verify`
Expected: all green. Fix anything that isn't before proceeding.

- [ ] **Step 2: Ad-hoc Playwright checks against the production build**

Start: `npm run preview` (production build, service worker active). With Playwright CLI against the preview origin, verify:

1. `/floodwatch/login` renders the email + password form ("Flood Watch admin sign-in", two inputs, "Sign in" button), zero console errors.
2. `/demo/en/login` redirects to `/floodwatch/login`.
3. `/auth/callback` redirects to `/floodwatch/login`.
4. `/en/login` redirects (chain) to `/floodwatch/login`.
5. `/floodwatch/admin` while signed out shows "Admin access required" with a Log In link pointing at `/floodwatch/login`.
6. `/floodwatch` public map renders with no admin shield icon and no console errors.
7. `/demo/en/report` shows all four form options (need / hazard / donation / purchase).
8. Submit the login form with a bogus email/password against the real demo Supabase → an inline error message appears (e.g. "Invalid login credentials"), no redirect loops.

- [ ] **Step 3: Commit any fixes; do not claim done without the suite green**

---

## Manual rollout steps (after code review — Supabase writes need Jacob's explicit go)

1. **Read-only precheck** (no approval needed): confirm `admin_users` table and `is_admin()` exist on the live project (`supabase db query --linked`), and list current rows/users.
2. **Provision admins** (approval): run `npm run create:admin` twice against the live project — Jacob (`jacobaskey@gmail.com`) and Hannah (`hapaguila@alum.up.edu.ph`) with strong temp passwords. Send Hannah hers via WhatsApp; she signs in at `https://floodwatch.kapwahelp.org/login`.
3. **DB cleanup** (approval): run `supabase/auth-password-migration.sql` against the live project.
4. **Dashboard hygiene** (approval): Supabase Auth settings — ensure the email provider allows password sign-in (enabled by default) and **disable new user signups** (Auth → Sign In / Up), so `signUp` calls from strangers are rejected.
5. **Edge function** (approval): `supabase functions delete invite-admin --project-ref iwhpypwefpdztfyrdngc`.
6. **Vercel** (approval): `vercel env rm VITE_AUTH_MODE` (all environments); confirm `floodwatch.kapwahelp.org` is attached as a domain of the `kapwa-help` project; deploy `main` after merge.
7. **Post-deploy smoke test**: sign in as Hannah's account on the live subdomain, approve a test report, log out.
