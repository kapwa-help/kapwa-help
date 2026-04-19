import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { ReliefMapPage } from "./pages/ReliefMapPage";
import { TransparencyPage } from "./pages/TransparencyPage";
import { ReportPage } from "./pages/ReportPage";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/en" replace /> },
  { path: "/auth/callback", element: <AuthCallbackPage /> },
  {
    path: "/:locale",
    element: <RootLayout />,
    children: [
      { index: true, element: <ReliefMapPage /> },
      { path: "dashboard", element: <TransparencyPage /> },
      { path: "transparency", element: <Navigate to="../dashboard" replace /> },
      { path: "report", element: <ReportPage /> },
      { path: "login", element: <LoginPage /> },
    ],
  },
]);
