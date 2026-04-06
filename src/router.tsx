import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { NeedsPage } from "./pages/NeedsPage";
import { DeploymentsPage } from "./pages/DeploymentsPage";
import { ReliefOperationsPage } from "./pages/ReliefOperationsPage";
import { ReportPage } from "./pages/ReportPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/en" replace />,
  },
  {
    path: "/:locale",
    element: <RootLayout />,
    children: [
      { index: true, element: <NeedsPage /> },
      { path: "deployments", element: <DeploymentsPage /> },
      { path: "relief-operations", element: <ReliefOperationsPage /> },
      { path: "report", element: <ReportPage /> },
    ],
  },
]);
