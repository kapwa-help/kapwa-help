import { createBrowserRouter, Navigate, useParams, useLocation } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { lazyWithReload } from "@/lib/lazy-reload";
import { AuthProvider } from "@/lib/auth-context";
const LandingPage = lazyWithReload(() => import("./pages/LandingPage"));

const ReliefMapPage = lazyWithReload(() => import("./pages/ReliefMapPage"));
const TransparencyPage = lazyWithReload(() => import("./pages/TransparencyPage"));
const ReportPage = lazyWithReload(() => import("./pages/ReportPage"));
const LoginPage = lazyWithReload(() => import("./pages/LoginPage"));
const AuthCallbackPage = lazyWithReload(() => import("./pages/AuthCallbackPage"));
const FloodWatchPage = lazyWithReload(() => import("./pages/FloodWatchPage"));
const FloodWatchAdminPage = lazyWithReload(() => import("./pages/FloodWatchAdminPage"));

function LegacyLocaleRedirect() {
  const { locale } = useParams<{ locale: string }>();
  const { pathname, search, hash } = useLocation();
  const suffix = pathname.replace(/^\/[^/]+/, "");
  return <Navigate to={`/demo/${locale ?? "en"}${suffix}${search}${hash}`} replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/auth/callback", element: <AuthCallbackPage /> },
  {
    path: "/demo/:locale",
    element: <RootLayout />,
    children: [
      { index: true, element: <ReliefMapPage /> },
      { path: "dashboard", element: <TransparencyPage /> },
      { path: "transparency", element: <Navigate to="../dashboard" replace /> },
      { path: "report", element: <ReportPage /> },
      { path: "login", element: <LoginPage /> },
    ],
  },
  { path: "/floodwatch", element: <AuthProvider><FloodWatchPage /></AuthProvider> },
  { path: "/floodwatch/admin", element: <AuthProvider><FloodWatchAdminPage /></AuthProvider> },
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
