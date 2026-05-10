import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  FolderOpen,
  Keyboard,
  Layers,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { FolderTreeView, type CachedTreeData } from "./folder-tree-view";

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

const TX3 = "#a8b4cc";

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
  const treeCacheRef = useRef<Map<string, CachedTreeData>>(new Map());

  const getTreeCache = useCallback((root: string) => treeCacheRef.current.get(root), []);
  const setTreeCache = useCallback((root: string, data: CachedTreeData) => {
    treeCacheRef.current.set(root, data);
  }, []);

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

  const totalRootsSelected = useMemo(() => {
    return rootFolders.filter((root) => {
      if (rootFolderSelected[root]) return true;
      const allPaths = allKnownPaths.get(root) ?? [];
      return allPaths.some((p) => !deselectedPaths.has(p));
    }).length;
  }, [rootFolders, rootFolderSelected, allKnownPaths, deselectedPaths]);

  const handleCreate = async () => {
    if (totalCount === 0) return;
    setIsCreating(true);
    setCreateError(null);
    setSkippedWarning(null);

    try {
      const latestPathMap = buildExistingCategoryPathMap(useCategoryManagementStore.getState().categories);

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

  const createDisabled = isCreating || isPendingTreeIndexUpdate || totalCount === 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,30,80,.42)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 30,
      }}
      className="klin-fade-in"
    >
      <div
        className="klin-slide-up"
        style={{
          width: "min(1080px, 96vw)",
          height: "min(720px, 92vh)",
          background: "var(--card)",
          borderRadius: 22,
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-2xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "22px 26px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 6px 18px var(--primary-glow)",
            }}
          >
            <Layers size={20} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "3px 9px",
                borderRadius: 14,
                background: "var(--primary-soft)",
                marginBottom: 5,
              }}
            >
              <Sparkles size={11} color="var(--primary)" />
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: "var(--primary)",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                Batch import
              </span>
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.5px",
                color: "var(--foreground)",
                marginBottom: 3,
              }}
            >
              Import folders as categories
            </h1>
            <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              Pick a root folder, then choose which subfolders KLIN should create as categories.{" "}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "1px 7px",
                  borderRadius: 6,
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "var(--muted-foreground)",
                  marginLeft: 4,
                }}
              >
                <Keyboard size={10} color="var(--muted-foreground)" />
                Shift+Click
              </span>{" "}
              selects a folder and all of its subfolders.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "var(--muted)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: "pointer",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#ffe6e6";
              e.currentTarget.style.borderColor = "#ffb4b4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--muted)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <X size={15} color="var(--muted-foreground)" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {/* Left rail */}
          <div
            style={{
              width: 280,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              background: "var(--muted)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "16px 16px 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: TX3,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                Selected folders
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "4px 12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {rootFolders.length === 0 ? (
                <div
                  style={{
                    padding: "24px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    lineHeight: 1.5,
                  }}
                >
                  No folders selected.
                  <br />
                  Click "Add more" to begin.
                </div>
              ) : (
                rootFolders.map((root) => {
                  const active = root === activeFolderPath;
                  const isDuplicate = hasDuplicateName(root, rootFolders);
                  const parentPath = isDuplicate ? getParentPath(root) : root;
                  const allPaths = allKnownPaths.get(root) ?? [];
                  const selectedInRoot =
                    (rootFolderSelected[root] ? 1 : 0) +
                    allPaths.filter((p) => !deselectedPaths.has(p)).length;
                  const any = selectedInRoot > 0;
                  return (
                    <button
                      key={root}
                      type="button"
                      onClick={() => setActiveFolderPath(root)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "11px 12px",
                        borderRadius: 12,
                        background: active ? "var(--card)" : "transparent",
                        border: `1.5px solid ${active ? "var(--primary)" : "transparent"}`,
                        boxShadow: active
                          ? "0 0 0 3px var(--primary-soft), var(--shadow-sm)"
                          : "none",
                        textAlign: "left",
                        transition: "all .12s",
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      {active && (
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 8,
                            bottom: 8,
                            width: 3,
                            background: "var(--primary)",
                            borderRadius: "0 3px 3px 0",
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          background: any ? "var(--primary-soft)" : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          border: `1px solid ${any ? "var(--primary-border)" : "var(--border)"}`,
                        }}
                      >
                        <FolderOpen
                          size={15}
                          color={any ? "var(--primary)" : "var(--muted-foreground)"}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: "var(--foreground)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {getFolderName(root)}
                        </div>
                        <div
                          style={{
                            fontSize: 10.5,
                            fontFamily: "var(--font-mono)",
                            color: TX3,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            marginTop: 1,
                          }}
                        >
                          {parentPath || root}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 3,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: any ? "var(--primary)" : TX3,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {selectedInRoot}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            color: TX3,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                          }}
                        >
                          picked
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
              {/* Add slot */}
              <button
                type="button"
                onClick={() => void handleAddMore()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "14px 12px",
                  borderRadius: 12,
                  background: "transparent",
                  border: "2px dashed var(--border)",
                  color: "var(--muted-foreground)",
                  transition: "all .12s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.color = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--muted-foreground)";
                }}
              >
                <Plus size={14} color="currentColor" />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>Browse for folder</span>
              </button>
            </div>

            {/* Footer summary */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: TX3,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  marginBottom: 5,
                }}
              >
                Across all roots
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    color: "var(--foreground)",
                    letterSpacing: "-0.5px",
                  }}
                >
                  {totalCount}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", fontWeight: 600 }}>
                  folders selected
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: TX3, marginTop: 3 }}>
                from {totalRootsSelected} root{totalRootsSelected === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {/* Right pane */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              background: "var(--card)",
            }}
          >
            {/* Tree header */}
            <div
              style={{
                padding: "14px 22px 14px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 14,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: TX3,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      marginBottom: 3,
                    }}
                  >
                    {activeFolderPath ? "Subfolders of" : "Subfolder preview"}
                  </div>
                  {activeFolderPath ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: "var(--foreground)",
                          letterSpacing: "-0.4px",
                        }}
                      >
                        {getFolderName(activeFolderPath)}
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontFamily: "var(--font-mono)",
                          color: "var(--muted-foreground)",
                          padding: "3px 9px",
                          borderRadius: 8,
                          background: "var(--muted)",
                          border: "1px solid var(--border)",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {activeFolderPath}
                      </span>
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Pick a folder on the left.
                    </span>
                  )}
                </div>

                {activeFolderPath && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0,
                      padding: 3,
                      borderRadius: 11,
                      background: "var(--muted)",
                      border: "1px solid var(--border)",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={!canSelectDeselect}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        color: "var(--primary)",
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        background: "transparent",
                        border: "none",
                        cursor: canSelectDeselect ? "pointer" : "not-allowed",
                        opacity: canSelectDeselect ? 1 : 0.4,
                        transition: "background .12s",
                      }}
                      onMouseEnter={(e) => {
                        if (canSelectDeselect)
                          e.currentTarget.style.background = "var(--primary-soft)";
                      }}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      All
                    </button>
                    <div style={{ width: 1, height: 14, background: "var(--border)" }} />
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      disabled={!canSelectDeselect}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        color: "var(--muted-foreground)",
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        background: "transparent",
                        border: "none",
                        cursor: canSelectDeselect ? "pointer" : "not-allowed",
                        opacity: canSelectDeselect ? 1 : 0.4,
                        transition: "background .12s",
                      }}
                      onMouseEnter={(e) => {
                        if (canSelectDeselect) e.currentTarget.style.background = "var(--card)";
                      }}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      None
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tree body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 12px" }}>
              {!activeFolderPath ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <FolderOpen
                      size={40}
                      color="var(--muted-foreground)"
                      style={{ opacity: 0.3, margin: "0 auto" }}
                    />
                    <p
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: "var(--muted-foreground)",
                      }}
                    >
                      Select a folder on the left to preview its subfolders.
                    </p>
                  </div>
                </div>
              ) : (
                <FolderTreeView
                  rootPath={activeFolderPath}
                  deselectedPaths={deselectedPaths}
                  focusPath={focusSubfolderPath}
                  onToggle={handleToggleDeselected}
                  onToggleMany={handleToggleManyDeselected}
                  onAllPathsLoaded={handleAllPathsLoaded}
                  getCache={getTreeCache}
                  setCache={setTreeCache}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 26px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
            background: "var(--muted)",
          }}
        >
          {skippedWarning ? (
            <div
              className="klin-fade-in"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 10,
                background: "rgba(245,158,11,.12)",
                border: "1.5px solid rgba(245,158,11,.3)",
                maxWidth: "60%",
              }}
            >
              <AlertCircle size={13} color="#d97706" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#a85d00",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {skippedWarning}
              </span>
            </div>
          ) : createError ? (
            <div
              className="klin-fade-in"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 10,
                background: "var(--destructive-tint)",
                border: "1.5px solid var(--destructive-border)",
                maxWidth: "60%",
              }}
            >
              <AlertCircle size={13} color="var(--destructive)" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--destructive)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {createError}
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 13px",
                borderRadius: 10,
                background: "var(--primary-soft)",
                border: "1.5px solid var(--primary-border)",
              }}
            >
              <div
                className="klin-pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--primary)",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--primary)",
                  letterSpacing: ".02em",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)" }}>{totalCount}</span>{" "}
                {totalCount === 1 ? "category" : "categories"} will be created
              </span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              background: "var(--card)",
              border: "1.5px solid var(--border)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              boxShadow: "var(--shadow-sm)",
              transition: "all .12s",
              cursor: isCreating ? "not-allowed" : "pointer",
              opacity: isCreating ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isCreating) e.currentTarget.style.borderColor = "#c1cdee";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={createDisabled}
            title={
              isCreating
                ? "Creating categories…"
                : isPendingTreeIndexUpdate
                  ? "Still indexing folders — please wait"
                  : totalCount === 0
                    ? "Select at least one folder to create"
                    : "Create the selected categories"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 22px",
              borderRadius: 12,
              background: "var(--primary)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: ".01em",
              border: "none",
              opacity: createDisabled ? 0.4 : 1,
              cursor: createDisabled ? "not-allowed" : "pointer",
              boxShadow: "0 6px 18px var(--primary-glow)",
              transition: "all .15s",
            }}
          >
            <Check size={14} color="#fff" strokeWidth={2.4} />
            {isCreating ? "Creating…" : "Create"}
            {!isCreating && totalCount > 0 && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  padding: "1px 7px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,.18)",
                  fontSize: 11.5,
                }}
              >
                {totalCount}
              </span>
            )}
            {!isCreating && (totalCount === 1 ? " category" : " categories")}
          </button>
        </div>
      </div>
    </div>
  );
}
