import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { CategoriesPage } from "@/features/categories/categories-page";
import { RulesPage } from "@/features/rules/rules-page";
import { LogsPage } from "@/features/logs/logs-page";
import { AutomationPage } from "@/features/automation/automation-page";
import { PrivacyPage } from "@/features/privacy/privacy-page";
import { FileHealthPage } from "@/features/file-health/file-health-page";
import { NotesPage } from "@/features/notes/notes-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { DeveloperPage } from "@/features/developer/developer-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "automation", element: <AutomationPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "file-health", element: <FileHealthPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "developer", element: <DeveloperPage /> },
    ],
  },
]);
