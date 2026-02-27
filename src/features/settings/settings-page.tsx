import { useEffect, useMemo, useState } from "react";
import { Mail, SlidersHorizontal, UserCircle2 } from "lucide-react";
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

  const profileInitial = (profile?.name?.trim()?.charAt(0) || "G").toUpperCase();

  return (
    <div className="space-y-5 pb-10">
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <button
          type="button"
          onClick={() => {
            if (!isLoggedIn) {
              void login();
            }
          }}
          className={cn(
            "flex min-w-0 items-center gap-3 text-left transition-opacity",
            !isLoggedIn && "hover:opacity-90",
          )}
          disabled={isLoggedIn || authStatus === "loading"}
        >
          {isLoggedIn && profile?.picture ? (
            <img
              src={profile.picture}
              alt={profile.name}
              className="h-12 w-12 rounded-full border border-border/60 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-sm font-semibold text-foreground">
              {isLoggedIn ? profileInitial : <UserCircle2 className="h-6 w-6 text-muted-foreground" />}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {isLoggedIn ? (profile?.name ?? "Google account") : "Not connected"}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {isLoggedIn ? (profile?.email || "No email available") : "Connect to Google to show profile"}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Button variant="outline" onClick={() => void logout()}>Disconnect</Button>
          ) : (
            <Button onClick={() => void login()} disabled={authStatus === "loading"}>
              {authStatus === "loading" ? "Connecting..." : "Connect Google"}
            </Button>
          )}
        </div>
      </section>

      {authError && <p className="text-xs text-destructive">{authError}</p>}

      <section className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <h2 className="text-base font-semibold">Manage Settings</h2>
        <Button variant="outline" className="h-10 gap-2" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" /> Open
        </Button>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Auto Organize</h2>
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
      </section>

      <SettingsManagementDialogs
        open={open}
        sections={["default-folder", "watched-folders", "categories"]}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
