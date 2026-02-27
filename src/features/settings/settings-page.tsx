import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { cn } from "@/lib/utils";
import { googleAuthService } from "@/features/auth/google-auth-service";
import { useAuthStore } from "@/features/auth/use-auth-store";

export function SettingsPage() {
  const [open, setOpen] = useState(false);
  const [autoOrganizeEnabled, setAutoOrganizeEnabled] = useState(false);

  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const profile = useAuthStore((state) => state.profile);
  const accessToken = useAuthStore((state) => state.accessToken);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  const isLoggedIn = useMemo(() => {
    if (!accessToken) {
      return false;
    }
    return !googleAuthService.isExpired(expiresAt);
  }, [accessToken, expiresAt]);

  return (
    <div className="space-y-6 pb-10">
      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Manage Settings</CardTitle>
          <CardDescription>Default folder, watched folders, and categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="h-11 gap-2" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Open Settings Window
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Google Calendar</CardTitle>
          <CardDescription>Connect your Google account.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{isLoggedIn ? (profile?.name ?? "Connected") : "Not connected"}</p>
            {authError && <p className="mt-1 text-xs text-destructive">{authError}</p>}
          </div>
          {isLoggedIn ? (
            <Button variant="outline" onClick={() => void logout()}>Disconnect</Button>
          ) : (
            <Button onClick={() => void login()} disabled={authStatus === "loading"}>
              {authStatus === "loading" ? "Connecting..." : "Connect Google"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Auto Organize</CardTitle>
          <CardDescription />
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Auto Organize</span>
          <button
            type="button"
            onClick={() => setAutoOrganizeEnabled((state) => !state)}
            role="switch"
            aria-pressed={autoOrganizeEnabled}
            aria-checked={autoOrganizeEnabled}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-2 py-1 transition-colors",
              autoOrganizeEnabled
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                autoOrganizeEnabled ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full bg-background shadow transition-transform",
                  autoOrganizeEnabled ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </span>
            <span className="w-8 text-left text-xs font-semibold">{autoOrganizeEnabled ? "On" : "Off"}</span>
          </button>
        </CardContent>
      </Card>

      <SettingsManagementDialogs
        open={open}
        sections={["default-folder", "watched-folders", "categories"]}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
