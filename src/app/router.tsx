import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { HistoryPage } from "@/features/history/history-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { NotesPage } from "@/features/notes/notes-page";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { DeveloperPage } from "@/features/developer/developer-page";
import { OAuthCallbackPage } from "@/features/auth/oauth-callback-page";
import { RouteErrorPage } from "@/app/route-error-page";

export const router = createBrowserRouter([
  {
    path: "/oauth-callback",
    element: <OAuthCallbackPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "developer", element: <DeveloperPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

