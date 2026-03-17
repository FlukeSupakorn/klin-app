import { useEffect, useRef } from "react";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/not-use-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/not-use-ui/card";
import { useAuthStore } from "@/features/auth/use-auth-store";

export function OAuthCallbackPage() {
  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const callbackHashRef = useRef(window.location.hash);

  const triggerDeepLink = (hash: string) => {
    const target = hash.includes("access_token=") ? `klin://auth${hash}` : "klin://auth";
    const a = document.createElement("a");
    a.href = target;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    const hash = callbackHashRef.current;
    if (hash.includes("access_token=")) {
      triggerDeepLink(hash);
    }
    void initialize();
  }, [initialize]);

  const openApp = () => {
    triggerDeepLink(callbackHashRef.current);
  };

  const isLoading = !initialized || status === "loading";
  const isSuccess = initialized && status === "authenticated";
  const isError = initialized && status === "error";
  const isIdle = initialized && status === "idle";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-center font-syne text-2xl font-black uppercase tracking-tight">
            Google Login
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Connecting to KLIN...</p>
                <p className="text-sm text-muted-foreground">
                  Syncing your Google account with the app. This should complete automatically.
                </p>
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Connected to KLIN.</p>
                  <p className="text-sm text-muted-foreground">
                    Your Google account has been synced with the app. You can close this browser tab and continue in KLIN.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={openApp}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Retry Connection
                </Button>
              </div>
            </div>
          )}

          {isError && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Could not complete sign-in.</p>
                  <p className="text-sm text-muted-foreground">
                    {error ?? "Authentication failed. Please try again."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={openApp}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Retry Connection
                </Button>
              </div>
            </div>
          )}

          {isIdle && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">No active login callback detected.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can close this tab and continue in the app, or open KLIN again.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={openApp}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open KLIN App
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
