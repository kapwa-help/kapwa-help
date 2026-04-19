import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { installPerfLogging, mark } from "./lib/perf-log";
import { router } from "./router";
import { AppShell } from "./components/AppShell";
import UpdatePrompt from "./components/UpdatePrompt";
import { AuthProvider } from "./lib/auth-context";
import "./i18n";
import "./index.css";

installPerfLogging();
mark("app:js-executed");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<AppShell />}>
      <AuthProvider>
        <RouterProvider router={router} />
        <UpdatePrompt />
      </AuthProvider>
    </Suspense>
  </StrictMode>,
);
