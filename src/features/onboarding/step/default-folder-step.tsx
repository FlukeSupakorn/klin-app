import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tauriClient } from "@/services/tauri-client";
import {
  FolderOpen,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface DefaultFolderStepProps {
  value: string;
  onChange: (val: string) => void;
  onNext: () => void;
}

const SUGGESTED_PATHS = [
  { label: "Home folder", path: "~/KLIN" },
  { label: "Documents", path: "~/Documents/KLIN" },
  { label: "Desktop", path: "~/Desktop/KLIN" },
  { label: "Custom drive", path: "/Volumes/MyDrive/KLIN" },
];

export function DefaultFolderStep({
  value,
  onChange,
  onNext,
}: DefaultFolderStepProps) {
  const [isBrowsing, setIsBrowsing] = useState(false);

  const handleNext = () => {
    if (!value.trim()) return;
    onNext();
  };

  const handleSuggestion = (path: string) => {
    onChange(path);
  };

  const handleBrowse = async () => {
    setIsBrowsing(true);
    try {
      const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
      if (folder) {
        onChange(folder);
      }
    } finally {
      setIsBrowsing(false);
    }
  };

  return (
    <div className="flex flex-col gap-7 w-full max-w-md">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="mb-1 flex items-center gap-2 text-primary">
          <FolderOpen className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Step 1 of 4</span>
        </div>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight text-foreground">Default Folder</h2>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          KLIN will create organized subfolders here. All sorted files will be
          moved into your chosen base directory.
        </p>
      </div>

      {/* Path input */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-widest">
          Base directory path
        </label>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Base path for categories"
            className="border-border bg-muted/30"
          />
          <Button
            variant="outline"
            onClick={() => void handleBrowse()}
            disabled={isBrowsing}
          >
            Browse Folder
          </Button>
        </div>
      </div>

      {/* Suggested paths */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          Suggestions
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTED_PATHS.map(({ label, path }) => (
            <button
              key={path}
              onClick={() => handleSuggestion(path)}
              className={cn(
                "flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition-all duration-200",
                value === path
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-primary",
              )}
            >
              <span className="text-[11px] font-medium text-foreground">
                {label}
              </span>
              <span className="text-[10px] truncate w-full">{path}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Info notice */}
      <div className="flex gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          KLIN will automatically create category subfolders inside this base
          path. You can change this at any time from Settings.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleNext}
          className="flex-1 font-semibold"
          disabled={isBrowsing || !value.trim()}
        >
          {isBrowsing ? "Opening..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
