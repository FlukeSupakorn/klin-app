import { useState } from "react";
import { Folder, FolderSearch, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsManagementDialogs, type SettingsSection } from "@/features/settings/settings-management-dialogs";

export function SettingsPage() {
  const [openSection, setOpenSection] = useState<SettingsSection | null>(null);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Open management windows for default folder, watched folders, and categories.</p>
      </div>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Manage Settings</CardTitle>
          <CardDescription>Open each setting in its own management window.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Button variant="outline" className="h-11 gap-2" onClick={() => setOpenSection("default-folder")}>
            <Folder className="h-4 w-4" /> Set Default Folder
          </Button>
          <Button variant="outline" className="h-11 gap-2" onClick={() => setOpenSection("watched-folders")}>
            <FolderSearch className="h-4 w-4" /> Set Watched Folder
          </Button>
          <Button variant="outline" className="h-11 gap-2" onClick={() => setOpenSection("categories")}>
            <Tags className="h-4 w-4" /> Set Category
          </Button>
        </CardContent>
      </Card>

      <SettingsManagementDialogs openSection={openSection} onClose={() => setOpenSection(null)} />
    </div>
  );
}
