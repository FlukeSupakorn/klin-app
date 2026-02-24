import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { AutomationPage } from "@/features/automation/automation-page";
import { CategoriesPage } from "@/features/categories/categories-page";
import { RulesPage } from "@/features/rules/rules-page";
import { LogsPage } from "@/features/logs/logs-page";
import { SettingsPage } from "@/features/settings/settings-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "automation", element: <AutomationPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
