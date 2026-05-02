import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tauriClient } from "@/services/tauri-client";
import type { WatcherFolder } from "@/types/onboarding";
import {
  AlertCircle,
  Eye,
  FolderInput,
  FolderOpen,
  Info,
  Trash2,
} from "lucide-react";

interface WatcherStepProps {
  basePath: string;
  folders: WatcherFolder[];
  onFoldersChange: (folders: WatcherFolder[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WatcherStep({
  basePath,
  folders,
  onFoldersChange,
  onNext,
  onBack,
}: WatcherStepProps) {
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");

  const addFolder = (pathOverride?: string) => {
    const trimmed = (pathOverride ?? newPath).trim();
    if (!trimmed) {
      setError("Enter a directory path to watch.");
      return;
    }
    if (folders.find((f) => f.path === trimmed)) {
      setError("This path is already being watched.");
      return;
    }
    setError("");
    onFoldersChange([
      ...folders,
      { id: `watcher-${Date.now()}`, path: trimmed },
    ]);
    setNewPath("");
  };

  const handleBrowse = async () => {
    const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (folder) {
      const trimmed = folder.trim();
      if (trimmed && !folders.find((f) => f.path === trimmed)) {
        setError("");
        onFoldersChange([
          ...folders,
          { id: `watcher-${Date.now()}`, path: trimmed },
        ]);
      }
    }
  };

  const removeFolder = (id: string) => {
    onFoldersChange(folders.filter((f) => f.id !== id));
  };


  return (
    <div className="flex flex-col gap-6 w-full max-w-lg">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="mb-1 flex items-center gap-2 text-primary">
          <Eye className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Step 4 of 4
          </span>
        </div>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight text-foreground">Watcher Folders</h2>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          KLIN monitors these directories in real-time. New files dropped in
          will be sorted automatically into your base path.
        </p>
      </div>

      {/* Add folder form */}
      <div className="space-y-2">
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Add directory to watch
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm pointer-events-none">
              ~/
            </span>
            <input
              type="text"
              value={newPath}
              onChange={(e) => {
                setNewPath(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && addFolder()}
              placeholder="Downloads"
              spellCheck={false}
              className={cn(
                "w-full rounded-xl border bg-muted/30 py-3 pl-8 pr-3 font-mono text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground/50",
                "focus:border-primary focus:ring-2 focus:ring-primary/20",
                error ? "border-destructive" : "border-border"
              )}
            />
          </div>
          {/* Browse button */}
          <Button
            type="button"
            onClick={handleBrowse}
            title="Browse for folder"
            className="h-11 w-11 shrink-0 rounded-xl border border-border bg-muted/30 p-0 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            variant="ghost"
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
      </div>

      {/* Folder list */}
      <div className="space-y-2">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
            <FolderInput className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              No watch folders yet. Add one above or skip this step.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-3 transition-all duration-200 hover:border-primary/30"
              >
                <FolderInput className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-foreground truncate">
                    {folder.path}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => removeFolder(folder.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output preview */}
      <div className="flex gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-foreground">Output destination</p>
          <p className="inline-block rounded-md bg-muted px-2 py-1 font-mono text-muted-foreground">
            {basePath || "~/KLIN"}/
            <span className="text-primary">[category]</span>/
            <span className="text-muted-foreground/60">[year-month]/</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          className="border border-border bg-transparent px-5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex-1 font-semibold"
        >
          Finish Setup
        </Button>
      </div>
    </div>
  );
}
