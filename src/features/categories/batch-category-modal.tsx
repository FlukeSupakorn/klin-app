import { useCallback, useMemo, useState, useTransition } from "react";
import { FolderOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { cn } from "@/lib/utils";
import { FolderTreeView } from "./folder-tree-view";

interface BatchCategoryModalProps {
  initialFolders: string[];
  onClose: () => void;
}

function getFolderName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? path;
}

function getParentPath(path: string): string {
  const norm = path.replace(/[\\/]+$/, "");
  const idx = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return idx > 0 ? norm.slice(0, idx) : "";
}

function normPath(p: string): string {
  return p.replace(/[\\/]+$/, "").replace(/\\/g, "/").toLowerCase();
}

function isSamePath(a: string, b: string): boolean {
  return normPath(a) === normPath(b);
}

function getExistingCategoryName(path: string, existingByPath: Map<string, string>): string | null {
  return existingByPath.get(normPath(path)) ?? null;
}

function isStrictAncestor(ancestor: string, descendant: string): boolean {
  const a = normPath(ancestor);
  const d = normPath(descendant);
  return a !== d && d.startsWith(a + "/");
}

function hasDuplicateName(folder: string, allFolders: string[]): boolean {
  const name = getFolderName(folder);
  return allFolders.some((f) => f !== folder && getFolderName(f) === name);
}

function deduplicatePaths(paths: string[]): string[] {
  const unique = [...new Set(paths)];
  return unique.filter(
    (p) => !unique.some((other) => other !== p && isStrictAncestor(other, p)),
  );
}

function buildExistingCategoryPathMap(categories: Array<{ folderPath: string; name: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of categories) {
    const normalized = cat.folderPath?.trim();
    if (!normalized) continue;
    map.set(normPath(normalized), cat.name);
  }
  return map;
}

export function BatchCategoryModal({ initialFolders, onClose }: BatchCategoryModalProps) {
  const existingCategories = useCategoryManagementStore((state) => state.categories);
  const [rootFolders, setRootFolders] = useState<string[]>(() => deduplicatePaths(initialFolders));
  const [activeFolderPath, setActiveFolderPath] = useState<string | null>(
    () => deduplicatePaths(initialFolders)[0] ?? null,
  );
  const [deselectedPaths, setDeselectedPaths] = useState<Set<string>>(new Set());
  const [rootFolderSelected, setRootFolderSelected] = useState<Record<string, boolean>>({});
  const [allKnownPaths, setAllKnownPaths] = useState<Map<string, string[]>>(new Map());
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [skippedWarning, setSkippedWarning] = useState<string | null>(null);
  const [focusSubfolderPath, setFocusSubfolderPath] = useState<string | null>(null);
  const [isPendingTreeIndexUpdate, startTransition] = useTransition();

  const existingCategoryByPath = useMemo(() => {
    return buildExistingCategoryPathMap(existingCategories);
  }, [existingCategories]);

  const applyPick = useCallback(
    (picked: string[]) => {
      if (!picked.length) return;
      const reducedPick = deduplicatePaths(picked);
      const currentRoots = rootFolders;
      let coveredSkipCount = 0;
      let firstCoveredPair: { subfolder: string; ancestor: string } | null = null;
      const toAdd: string[] = [];
      const mergeMap = new Map<string, string[]>();

      for (const p of reducedPick) {
        if (currentRoots.some((r) => isSamePath(r, p))) {
          continue;
        }

        const ancestor = currentRoots.find((r) => isStrictAncestor(r, p));
        if (ancestor) {
          if (!firstCoveredPair) {
            firstCoveredPair = { subfolder: p, ancestor };
          }
          coveredSkipCount++;
          continue;
        }

        const replaced = currentRoots.filter((r) => isStrictAncestor(p, r));
        if (replaced.length > 0) {
          mergeMap.set(p, replaced);
          toAdd.push(p);
          continue;
        }

        toAdd.push(p);
      }

      if (toAdd.length > 0) {
        const allReplaced = [...mergeMap.values()].flat();

        setDeselectedPaths((prev) => {
          const next = new Set(prev);
          for (const replacedRoots of mergeMap.values()) {
            for (const r of replacedRoots) {
              if (!rootFolderSelected[r]) next.add(r);
            }
          }
          return next;
        });

        setRootFolderSelected((prev) => {
          const next = { ...prev };
          for (const r of allReplaced) delete next[r];
          return next;
        });

        setAllKnownPaths((prev) => {
          const next = new Map(prev);
          for (const r of allReplaced) next.delete(r);
          return next;
        });

        const nextRoots = [
          ...currentRoots.filter((r) => !allReplaced.some((removed) => isSamePath(removed, r))),
          ...toAdd,
        ];
        setRootFolders(nextRoots);

        if (toAdd.length > 0) {
          setActiveFolderPath(toAdd[0]);
        } else if (activeFolderPath && nextRoots.some((r) => isSamePath(r, activeFolderPath))) {
          setActiveFolderPath(activeFolderPath);
        } else {
          setActiveFolderPath(nextRoots[0] ?? null);
        }
      }

      const messages: string[] = [];
      if (coveredSkipCount > 0) {
        if (firstCoveredPair) {
          messages.push(
            `${coveredSkipCount} folder${coveredSkipCount !== 1 ? "s" : ""} skipped: "${getFolderName(firstCoveredPair.subfolder)}" is a subfolder of "${getFolderName(firstCoveredPair.ancestor)}"`,
          );
          setActiveFolderPath(firstCoveredPair.ancestor);
          setFocusSubfolderPath(firstCoveredPair.subfolder);
        } else {
          messages.push(
            `${coveredSkipCount} folder${coveredSkipCount !== 1 ? "s" : ""} skipped (already covered by a selected root)`,
          );
        }
      }
      if (messages.length > 0) {
        setSkippedWarning(messages.join(". "));
      } else {
        setSkippedWarning(null);
        setFocusSubfolderPath(null);
      }
    },
    [activeFolderPath, rootFolderSelected, rootFolders],
  );

  const handleAddMore = async () => {
    const picked = await tauriClient.pickFoldersForBatch().catch(() => [] as string[]);
    applyPick(picked);
  };

  const handleToggleDeselected = useCallback((path: string, checked: boolean) => {
    setDeselectedPaths((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleToggleManyDeselected = useCallback((paths: string[], checked: boolean) => {
    if (!paths.length) return;
    setDeselectedPaths((prev) => {
      const next = new Set(prev);
      for (const path of paths) {
        if (checked) {
          next.delete(path);
        } else {
          next.add(path);
        }
      }
      return next;
    });
  }, []);

  const handleAllPathsLoaded = useCallback((rootPath: string, allPaths: string[]) => {
    startTransition(() => {
      setAllKnownPaths((prev) => new Map([...prev, [rootPath, allPaths]]));
    });
  }, [startTransition]);

  const handleSelectAll = useCallback(() => {
    if (!activeFolderPath) return;
    const paths = allKnownPaths.get(activeFolderPath) ?? [];
    setDeselectedPaths((prev) => {
      const next = new Set(prev);
      for (const p of paths) next.delete(p);
      return next;
    });
  }, [activeFolderPath, allKnownPaths]);

  const handleDeselectAll = useCallback(() => {
    if (!activeFolderPath) return;
    const paths = allKnownPaths.get(activeFolderPath) ?? [];
    setDeselectedPaths((prev) => {
      const next = new Set(prev);
      for (const p of paths) next.add(p);
      return next;
    });
  }, [activeFolderPath, allKnownPaths]);

  const canSelectDeselect = useMemo(() => {
    return activeFolderPath !== null && allKnownPaths.has(activeFolderPath);
  }, [activeFolderPath, allKnownPaths]);

  const totalCount = useMemo(() => {
    let count = 0;
    for (const root of rootFolders) {
      if (rootFolderSelected[root]) count++;
      const allPaths = allKnownPaths.get(root) ?? [];
      for (const p of allPaths) {
        if (!deselectedPaths.has(p)) count++;
      }
    }
    return count;
  }, [rootFolders, rootFolderSelected, allKnownPaths, deselectedPaths]);

  const handleCreate = async () => {
    await categoryManagementService.refreshCategoriesFromWorker().catch(() => { });
    const latestPathMap = buildExistingCategoryPathMap(useCategoryManagementStore.getState().categories);
    if (totalCount === 0) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const items: Array<{ name: string; path: string }> = [];
      const seen = new Set<string>();

      for (const root of rootFolders) {
        if (rootFolderSelected[root] && !seen.has(root) && !getExistingCategoryName(root, latestPathMap)) {
          seen.add(root);
          items.push({ name: getFolderName(root), path: root });
        }
        const allPaths = allKnownPaths.get(root) ?? [];
        for (const p of allPaths) {
          if (!deselectedPaths.has(p) && !seen.has(p) && !getExistingCategoryName(p, latestPathMap)) {
            seen.add(p);
            items.push({ name: getFolderName(p), path: p });
          }
        }
      }

      if (items.length === 0) {
        setCreateError("All selected folders already exist as categories.");
        return;
      }

      await categoryManagementService.batchCreateFromFolders(items);
      onClose();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create categories");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Batch Import
            </p>
            <h2 className="font-syne text-xl font-black uppercase tracking-tight">
              Import Folders as Categories
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-row overflow-hidden">
          <div className="flex w-80 shrink-0 flex-col border-r border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Selected Folders
              </p>
              <button
                type="button"
                onClick={() => void handleAddMore()}
                className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" /> Add More
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {rootFolders.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-center text-xs text-muted-foreground">
                    No folders selected.
                    <br />
                    Click Add More to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {rootFolders.map((folder) => {
                    const isDuplicate = hasDuplicateName(folder, rootFolders);
                    const parentPath = isDuplicate ? getParentPath(folder) : "";
                    return (
                      <div
                        key={folder}
                        className={cn(
                          "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60",
                          activeFolderPath === folder && "bg-accent/80",
                        )}
                        onClick={() => setActiveFolderPath(folder)}
                      >
                        <input
                          type="checkbox"
                          checked={!!rootFolderSelected[folder]}
                          title="Include this folder itself as a category"
                          onChange={(e) => {
                            e.stopPropagation();
                            setRootFolderSelected((prev) => ({
                              ...prev,
                              [folder]: e.target.checked,
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <FolderOpen
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            activeFolderPath === folder ? "text-primary" : "text-primary/60",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {getFolderName(folder)}
                          </span>
                          {isDuplicate && parentPath && (
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {parentPath}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {activeFolderPath
                    ? `Subfolders of "${getFolderName(activeFolderPath)}"`
                    : "Subfolder Preview"}
                </p>
                {activeFolderPath && (
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {activeFolderPath}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Tip: Shift+Click a checkbox to select/deselect that folder and all its subfolders.
                </p>
              </div>

              {activeFolderPath && (
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  <button
                    type="button"
                    disabled={!canSelectDeselect}
                    onClick={handleSelectAll}
                    className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    All
                  </button>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <button
                    type="button"
                    disabled={!canSelectDeselect}
                    onClick={handleDeselectAll}
                    className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    None
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {!activeFolderPath ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Select a folder on the left to preview its subfolders.
                    </p>
                  </div>
                </div>
              ) : (
                <FolderTreeView
                  key={activeFolderPath}
                  rootPath={activeFolderPath}
                  deselectedPaths={deselectedPaths}
                  focusPath={focusSubfolderPath}
                  onToggle={handleToggleDeselected}
                  onToggleMany={handleToggleManyDeselected}
                  onAllPathsLoaded={handleAllPathsLoaded}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-6 py-3">
          {skippedWarning && (
            <p className="text-xs font-medium text-amber-500">{skippedWarning}</p>
          )}
          {createError && (
            <p className="text-xs text-destructive">{createError}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
              {totalCount} folder{totalCount !== 1 ? "s" : ""} will be created
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={isCreating || isPendingTreeIndexUpdate || totalCount === 0}
              >
                {isCreating ? "Creating…" : "Create Categories"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
