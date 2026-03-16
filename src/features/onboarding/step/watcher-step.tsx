import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tauriClient } from "@/services/tauri-client";
import type { WatcherFolder } from "../types";
import {
  AlertCircle,
  Eye,
  FolderInput,
  FolderOpen,
  Info,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
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
  const [newRecursive, setNewRecursive] = useState(true);
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
      { id: `watcher-${Date.now()}`, path: trimmed, recursive: newRecursive },
    ]);
    setNewPath("");
    setNewRecursive(true);
  };

  const handleBrowse = async () => {
    const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (folder) {
      const trimmed = folder.trim();
      if (trimmed && !folders.find((f) => f.path === trimmed)) {
        setError("");
        onFoldersChange([
          ...folders,
          { id: `watcher-${Date.now()}`, path: trimmed, recursive: newRecursive },
        ]);
      }
    }
  };

  const removeFolder = (id: string) => {
    onFoldersChange(folders.filter((f) => f.id !== id));
  };

  const toggleRecursive = (id: string) => {
    onFoldersChange(
      folders.map((f) =>
        f.id === id ? { ...f, recursive: !f.recursive } : f
      )
    );
  };


  return (
    <div className="flex flex-col gap-6 w-full max-w-lg">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[--brand] mb-1">
          <Eye className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-widest">
            Step 4 of 4
          </span>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Watcher Folders</h2>
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
                "w-full pl-8 pr-3 py-3 rounded-xl bg-[--surface-2] border font-mono text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200",
                "focus:border-[--brand] focus:ring-2 focus:ring-[--brand]/20",
                error ? "border-destructive" : "border-[--border]"
              )}
            />
          </div>
          {/* Browse button */}
          <Button
            type="button"
            onClick={handleBrowse}
            title="Browse for folder"
            className="h-11 w-11 p-0 bg-[--surface-2] hover:bg-[--brand-dim] text-muted-foreground hover:text-[--brand] border border-[--border] hover:border-[--brand]/40 flex-shrink-0 rounded-xl"
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

        {/* Recursive toggle */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[--surface-2] border border-[--border]">
          <button
            onClick={() => setNewRecursive(!newRecursive)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {newRecursive ? (
              <ToggleRight className="w-5 h-5 text-[--brand]" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            <span>
              <strong className="text-foreground">Recursive</strong> — also
              watch subdirectories
            </span>
          </button>
        </div>
      </div>

      {/* Folder list */}
      <div className="space-y-2">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed border-[--border] text-center">
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
                className="group flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[--surface-2] border border-[--border] hover:border-[--brand]/30 transition-all duration-200"
              >
                <FolderInput className="w-4 h-4 text-[--brand] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-foreground truncate">
                    {folder.path}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {folder.recursive ? "Watching recursively" : "Top-level only"}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleRecursive(folder.id)}
                    title={folder.recursive ? "Disable recursive" : "Enable recursive"}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[--surface-3] text-muted-foreground hover:text-[--brand] transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
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
      <div className="flex gap-2.5 p-3.5 rounded-xl bg-[--surface-2] border border-[--border]">
        <Info className="w-4 h-4 text-[--brand] flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-foreground">Output destination</p>
          <p className="font-mono text-muted-foreground bg-[--surface-3] px-2 py-1 rounded-md inline-block">
            {basePath || "~/KLIN"}/
            <span className="text-[--brand]">[category]</span>/
            <span className="text-muted-foreground/60">[year-month]/</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          className=" px-5 text-muted-foreground hover:text-foreground border border-[--border] bg-transparent hover:bg-[--surface-2]"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex-1 font-semibold border-0"
        >
          Finish Setup
        </Button>
      </div>
    </div>
  );
}
