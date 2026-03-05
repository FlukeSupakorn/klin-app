import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { HistoryPage } from "@/features/history/history-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { AutomationPage } from "@/features/automation/automation-page";
import { CategoriesPage } from "@/features/categories/categories-page";
import { RulesPage } from "@/features/rules/rules-page";
import { NotesPage } from "@/features/notes/notes-page";
import { FileHealthPage } from "@/features/file-health/file-health-page";
import { PrivacyPage } from "@/features/privacy/privacy-page";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { DeveloperPage } from "@/features/developer/developer-page";
import { RouteErrorPage } from "@/app/route-error-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "automation", element: <AutomationPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "file-health", element: <FileHealthPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "developer", element: <DeveloperPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

