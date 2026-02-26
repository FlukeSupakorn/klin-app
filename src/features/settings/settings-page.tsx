import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [open, setOpen] = useState(false);
  const [autoOrganizeEnabled, setAutoOrganizeEnabled] = useState(false);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage app settings.</p>
      </div>

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
