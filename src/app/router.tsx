import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { HistoryPage } from "@/features/history/history-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { NotesPage } from "@/features/notes/notes-page";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { DeveloperPage } from "@/features/developer/developer-page";
import { OAuthCallbackPage } from "@/features/auth/oauth-callback-page";
import { RouteErrorPage } from "@/app/route-error-page";
import { ApiLogsPage } from "@/features/settings/api-logs-page";
import { OnboardingPage } from "@/features/onboarding/onboarding-page";
import { OnboardingGuard } from "@/features/onboarding/onboarding-guard";
import { ModelDownloadGuard } from "@/features/model-download/model-download-guard";
import { ModelDownloadPage } from "@/features/model-download/model-download-page";
import { WelcomeGuard } from "@/features/welcome/welcome-guard";
import { WelcomePage } from "@/features/welcome/welcome-page";

export const router = createBrowserRouter([
  {
    path: "/oauth-callback",
    element: <OAuthCallbackPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/welcome",
    element: <WelcomePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/onboarding",
    element: <WelcomeGuard><ModelDownloadGuard><OnboardingPage /></ModelDownloadGuard></WelcomeGuard>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/model-download",
    element: <WelcomeGuard><ModelDownloadPage /></WelcomeGuard>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/",
    // First-run chain: Welcome → ModelDownload → Onboarding → AppShell. Each guard handles its own concern.
    element: <WelcomeGuard><ModelDownloadGuard><OnboardingGuard /></ModelDownloadGuard></WelcomeGuard>,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/api-logs", element: <ApiLogsPage /> },
      { path: "developer", element: <DeveloperPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
