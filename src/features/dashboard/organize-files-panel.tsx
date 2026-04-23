import { FolderOpen, Upload } from "lucide-react";
import { FileDropOverlay } from "@/features/dashboard/file-drop-overlay";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { OrganizeFilesModal } from "@/features/dashboard/organize-files-panel/organize-files-modal";
import { useOrganizeWorkflow } from "@/hooks/organize/use-organize-workflow";

export function OrganizeFilesPanel() {
  const workflow = useOrganizeWorkflow();

  return (
    <div className="flex h-full flex-col">
      <FileDropOverlay visible={workflow.isDraggingOver} />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={workflow.handleDrop}
        onClick={() => void workflow.handleAddFiles()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void workflow.handleAddFiles();
          }
        }}
        className="cursor-pointer select-none transition-all duration-200"
        style={{
          flex: 1,
          borderRadius: 14,
          border: `2px dashed ${workflow.isDraggingOver ? "var(--primary)" : "var(--border)"}`,
          background: workflow.isDraggingOver ? "var(--primary-tint)" : "var(--muted)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: workflow.isDraggingOver
              ? "var(--primary)"
              : "var(--primary-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: workflow.isDraggingOver ? "0 8px 24px var(--primary-glow)" : "none",
          }}
        >
          <Upload
            className="h-7 w-7"
            style={{ color: workflow.isDraggingOver ? "#fff" : "var(--primary)" }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <div className="text-[15px] font-extrabold text-foreground">
            {workflow.isDraggingOver ? "Release to organize" : "Drop files here"}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            or click to browse your computer
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void workflow.handleAddFiles(); }}
          className="flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-bold text-white transition-all hover:opacity-90"
          style={{
            background: "var(--primary)",
            boxShadow: "0 4px 14px var(--primary-glow)",
          }}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Browse Files
        </button>
      </div>

      <OrganizeFilesModal workflow={workflow} />

      <SettingsManagementDialogs
        open={workflow.openSettingsWindow}
        sections={["default-folder", "categories"]}
        onClose={() => workflow.setOpenSettingsWindow(false)}
      />
    </div>
  );
}
