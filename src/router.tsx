import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { ReliefMapPage } from "./pages/ReliefMapPage";
import { TransparencyPage } from "./pages/TransparencyPage";
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
      { index: true, element: <ReliefMapPage /> },
      { path: "transparency", element: <TransparencyPage /> },
      { path: "report", element: <ReportPage /> },
    ],
  },
]);
