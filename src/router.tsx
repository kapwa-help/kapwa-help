import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { NeedsPage } from "./pages/NeedsPage";
import { ReliefPage } from "./pages/ReliefPage";
import { StoriesPage } from "./pages/StoriesPage";
import { SubmitPage } from "./pages/SubmitPage";

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
      { path: "relief", element: <ReliefPage /> },
      { path: "stories", element: <StoriesPage /> },
      { path: "submit", element: <SubmitPage /> },
    ],
  },
]);
