import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { installPerfLogging, mark } from "./lib/perf-log";
import { router } from "./router";
import UpdatePrompt from "./components/UpdatePrompt";
import "./i18n";
import "./index.css";

installPerfLogging();
mark("app:js-executed");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </Suspense>
  </StrictMode>,
);
