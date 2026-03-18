import { FolderOpen, Upload } from "lucide-react";
import { FileDropOverlay } from "@/features/dashboard/file-drop-overlay";
import { Button } from "@/components/not-use-ui/button";
import { Card, CardContent } from "@/components/not-use-ui/card";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { OrganizeFilesModal } from "@/features/dashboard/organize-files-panel/organize-files-modal";
import { useOrganizeWorkflow } from "@/features/dashboard/organize-files-panel/use-organize-workflow";

export function OrganizeFilesPanel() {
  const workflow = useOrganizeWorkflow();

  return (
    <>
      <FileDropOverlay visible={workflow.isDraggingOver} />

      <Card className="border border-border bg-card shadow-none">
        <CardContent className="p-0">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={workflow.handleDrop}
            onClick={() => void workflow.handleAddFiles()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void workflow.handleAddFiles();
              }
            }}
            className="flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20 px-8 py-16 text-center transition-all duration-150 hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-black text-foreground">Organize Files</p>
            <p className="mt-1 text-sm text-muted-foreground">Drag files here or click to select</p>
            <div className="mt-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">AI-powered categorization</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <OrganizeFilesModal workflow={workflow} />

      <SettingsManagementDialogs
        open={workflow.openSettingsWindow}
        sections={["default-folder", "categories"]}
        onClose={() => workflow.setOpenSettingsWindow(false)}
      />
    </>
  );
}
