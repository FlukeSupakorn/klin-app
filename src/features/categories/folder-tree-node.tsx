import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderTreeNodeProps {
  name: string;
  path: string;
  indentLevel: number;
  checked: boolean;
  onToggle: (path: string, checked: boolean) => void;
  onToggleSubtree?: (path: string, checked: boolean) => void;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: (path: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  existingCategoryName?: string;
  highlighted?: boolean;
  pathKey?: string;
  children?: React.ReactNode;
}

export function FolderTreeNode({
  name,
  path,
  indentLevel,
  checked,
  onToggle,
  onToggleSubtree,
  hasChildren,
  isExpanded,
  onToggleExpand,
  isLoading = false,
  disabled = false,
  existingCategoryName,
  highlighted = false,
  pathKey,
  children,
}: FolderTreeNodeProps) {
  return (
    <div>
      <div
        data-path-key={pathKey}
        className={cn(
          "flex cursor-default items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60",
          disabled && "bg-muted/30 opacity-80",
          highlighted && "bg-primary/10 ring-1 ring-primary/30",
        )}
        style={{ paddingLeft: `${0.5 + indentLevel * 1.25}rem` }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            const nextChecked = !checked;
            if (e.shiftKey && onToggleSubtree) {
              onToggleSubtree(path, nextChecked);
              return;
            }
            onToggle(path, nextChecked);
          }}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          title={hasChildren ? "Click: this folder only | Shift+Click: this folder and all subfolders" : undefined}
        />

        {hasChildren || isLoading ? (
          <button
            type="button"
            onClick={() => onToggleExpand(path)}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {isLoading ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
            ) : isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}

        <Folder className="h-3.5 w-3.5 shrink-0 text-primary/60" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn("select-none truncate text-sm font-medium", disabled && "text-muted-foreground")}
            onClick={() => {
              if (hasChildren && !isLoading) onToggleExpand(path);
            }}
          >
            {name}
          </span>
          {disabled && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Created{existingCategoryName ? `: ${existingCategoryName}` : ""}
            </span>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
