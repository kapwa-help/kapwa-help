import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { lazyWithReload } from "@/lib/lazy-reload";

const ReliefMapPage = lazyWithReload(
  () => import("./pages/ReliefMapPage")
);
const TransparencyPage = lazyWithReload(
  () => import("./pages/TransparencyPage")
);
const ReportPage = lazyWithReload(
  () => import("./pages/ReportPage")
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/en" replace />,
  },
  {
    path: "/:locale",
    element: <RootLayout />,
    children: [
      { index: true, element: <ReliefMapPage /> },
      { path: "dashboard", element: <TransparencyPage /> },
      { path: "transparency", element: <Navigate to="../dashboard" replace /> },
      { path: "report", element: <ReportPage /> },
    ],
  },
]);
