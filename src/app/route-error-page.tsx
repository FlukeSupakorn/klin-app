import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function RouteErrorPage() {
  const error = useRouteError();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Something went wrong while loading this page.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-8 text-center shadow-xs">
        <h1 className="text-2xl font-semibold tracking-tight">Page not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link to="/">Back to Dashboard</Link>
          </Button>
          <Button variant="outline" onClick={() => window.location.assign("/")}>
            Reload App
          </Button>
        </div>
      </div>
    </div>
  );
}
