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
// Exported for unit tests — the host branch can't be exercised in a browser test.
export function floodWatchRouteConfig(onFloodHost: boolean) {
  return onFloodHost
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
}

const floodWatchRoutes = floodWatchRouteConfig(isFloodWatchHost());

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
