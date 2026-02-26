import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";

export function SettingsPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Open one management window for default folder, watched folders, and categories.</p>
      </div>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Manage Settings</CardTitle>
          <CardDescription>Open all settings in one window.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="h-11 gap-2" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Open Settings Window
          </Button>
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
