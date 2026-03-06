import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { FolderOpen, Sparkles, Upload } from "lucide-react";
import { FileDropOverlay } from "@/features/dashboard/file-drop-overlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { organizeApiService } from "@/services/organize-api-service";
import { tauriClient } from "@/services/tauri-client";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { cn } from "@/lib/utils";
import type { OrganizePreviewItem } from "@/types/domain";

export function OrganizeFilesPanel() {
  const categories = useCategoryManagementStore((state) => state.categories);
  const defaultFolder = useCategoryManagementStore((state) => state.defaultFolder);
  const [items, setItems] = useState<OrganizePreviewItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openSuggestionFor, setOpenSuggestionFor] = useState<string | null>(null);
  const [movedItemIds, setMovedItemIds] = useState<string[]>([]);
  const [openSettingsWindow, setOpenSettingsWindow] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const lastNativeDropAtRef = useRef(0);

  const openWithPaths = async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const analyzedItems = await organizeApiService.analyze(paths, categories);
      setItems(analyzedItems);
      setMovedItemIds([]);
    } catch {
      setErrorMessage("Could not load suggestions. Check your worker sidecar at 127.0.0.1:8000.");
      setItems([]);
      setMovedItemIds([]);
    } finally {
      setIsAnalyzing(false);
    }

    setModalOpen(true);
  };

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    let unlistenNative: (() => void) | undefined;
    let unlistenLegacyDrop: (() => void) | undefined;
    let unlistenLegacyHover: (() => void) | undefined;
    let unlistenLegacyCancelled: (() => void) | undefined;

    const registerError = (label: string, error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[drag-drop] ${label}: ${message}`);
    };

    void appWindow
      .onDragDropEvent((event) => {
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setIsDraggingOver(true);
          return;
        }

        if (event.payload.type === "leave") {
          setIsDraggingOver(false);
          return;
        }

        if (event.payload.type === "drop") {
          setIsDraggingOver(false);
          lastNativeDropAtRef.current = Date.now();
          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            void openWithPaths(paths);
          }
        }
      })
      .then((fn) => {
        unlistenNative = fn;
      })
      .catch((error) => {
        registerError("onDragDropEvent", error);
      });

    void listen<string[]>("tauri://file-drop", (event) => {
      const paths = Array.isArray(event.payload) ? event.payload : [];
      setIsDraggingOver(false);
      lastNativeDropAtRef.current = Date.now();
      if (paths.length > 0) {
        void openWithPaths(paths);
      }
    })
      .then((fn) => {
        unlistenLegacyDrop = fn;
      })
      .catch((error) => {
        registerError("listen(tauri://file-drop)", error);
      });

    void listen("tauri://file-drop-hover", () => {
      setIsDraggingOver(true);
    })
      .then((fn) => {
        unlistenLegacyHover = fn;
      })
      .catch((error) => {
        registerError("listen(tauri://file-drop-hover)", error);
      });

    void listen("tauri://file-drop-cancelled", () => {
      setIsDraggingOver(false);
    })
      .then((fn) => {
        unlistenLegacyCancelled = fn;
      })
      .catch((error) => {
        registerError("listen(tauri://file-drop-cancelled)", error);
      });

    const onWindowDragEnter = (event: DragEvent) => {
      const hasFiles = event.dataTransfer?.types.includes("Files");
      if (!hasFiles) {
        return;
      }

      event.preventDefault();
      setIsDraggingOver(true);
    };

    const onWindowDragOver = (event: DragEvent) => {
      const hasFiles = event.dataTransfer?.types.includes("Files");
      if (!hasFiles) {
        return;
      }

      event.preventDefault();
      setIsDraggingOver(true);
    };

    const onWindowDragLeave = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingOver(false);
    };

    const onWindowDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingOver(false);
    };

    window.addEventListener("dragenter", onWindowDragEnter);
    window.addEventListener("dragover", onWindowDragOver);
    window.addEventListener("dragleave", onWindowDragLeave);
    window.addEventListener("drop", onWindowDrop);

    return () => {
      unlistenNative?.();
      unlistenLegacyDrop?.();
      unlistenLegacyHover?.();
      unlistenLegacyCancelled?.();
      window.removeEventListener("dragenter", onWindowDragEnter);
      window.removeEventListener("dragover", onWindowDragOver);
      window.removeEventListener("dragleave", onWindowDragLeave);
      window.removeEventListener("drop", onWindowDrop);
    };

  }, []);

  const handleAddFiles = async () => {
    const selected = await tauriClient.pickFilesForOrganize();
    await openWithPaths(selected);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    if (Date.now() - lastNativeDropAtRef.current < 300) {
      return;
    }

    const dropped = Array.from(event.dataTransfer.files)
      .map((file) => {
      const fileWithPath = file as File & { path?: string };
      return fileWithPath.path;
      })
      .filter((value): value is string => Boolean(value));

    if (dropped.length === 0) {
      setErrorMessage("Could not read dropped file paths. Try dropping directly into the app window or use Add Files.");
      return;
    }

    void openWithPaths(dropped);
  };

  const normalizeCategoryLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const findCategoryByLabel = (label: string) => {
    const normalizedLabel = normalizeCategoryLabel(label);

    const exact = categories.find((entry) => normalizeCategoryLabel(entry.name) === normalizedLabel);
    if (exact) {
      return exact;
    }

    const contains = categories.find((entry) => {
      const normalizedCategory = normalizeCategoryLabel(entry.name);
      return normalizedCategory.includes(normalizedLabel) || normalizedLabel.includes(normalizedCategory);
    });

    if (contains) {
      return contains;
    }

    const firstToken = normalizedLabel.split(" ")[0] ?? "";
    if (!firstToken) {
      return undefined;
    }

    return categories.find((entry) => normalizeCategoryLabel(entry.name).includes(firstToken));
  };

  const applyCategory = (itemId: string, categoryName: string) => {
    const category = findCategoryByLabel(categoryName);

    setItems((state) => {
      return state.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const activeName = item.suggestedName ?? item.fileName;
        const folderPath = category ? category.folderPath : `${defaultFolder}/${categoryName}`;

        return {
          ...item,
          selectedCategory: category?.name ?? categoryName,
          destinationPath: `${folderPath}/${activeName}`,
        };
      });
    });
  };

  const applySuggestedName = (itemId: string, selectedName: string | null) => {
    setItems((state) => {
      return state.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const slashIndex = Math.max(item.destinationPath.lastIndexOf("/"), item.destinationPath.lastIndexOf("\\"));
        const folderPath = slashIndex >= 0 ? item.destinationPath.slice(0, slashIndex) : item.destinationPath;

        const finalName = selectedName ?? item.fileName;

        return {
          ...item,
          suggestedName: selectedName,
          destinationPath: `${folderPath}/${finalName}`,
        };
      });
    });

    setOpenSuggestionFor(null);
  };

  const toggleMoved = (itemId: string) => {
    setMovedItemIds((state) =>
      state.includes(itemId) ? state.filter((id) => id !== itemId) : [...state, itemId],
    );
  };

  const toggleMoveAll = () => {
    if (items.length === 0) {
      return;
    }

    setMovedItemIds((state) =>
      state.length === items.length ? [] : items.map((item) => item.id),
    );
  };

  const allMoved = items.length > 0 && movedItemIds.length === items.length;

  return (
    <>
      <FileDropOverlay visible={isDraggingOver} />

      <Card className="border border-border bg-card shadow-none">
        <CardContent className="p-0">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onClick={() => void handleAddFiles()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void handleAddFiles();
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="h-[80vh] w-full max-w-5xl overflow-hidden border border-border bg-card">
            <CardHeader>
              <CardTitle>Files to organize</CardTitle>
              <CardDescription>
                {isAnalyzing ? "Getting suggestions..." : `${items.length} file(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-[calc(80vh-96px)] flex-col gap-4 overflow-hidden">
              <Input placeholder="Search files..." />

              {errorMessage && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              {isAnalyzing && (
                <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Loading suggestions...
                </div>
              )}

              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{item.fileName}</p>
                        <p className="text-xs text-muted-foreground">{item.currentPath}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={movedItemIds.includes(item.id) ? "outline" : "default"}
                        onClick={() => toggleMoved(item.id)}
                      >
                        {movedItemIds.includes(item.id) ? "Undo" : "Move"}
                      </Button>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {item.topScores.map((score) => (
                        <button
                          type="button"
                          key={score.name}
                          onClick={() => applyCategory(item.id, score.name)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs transition-colors",
                            item.selectedCategory === score.name
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          {score.name} · {Math.round(score.score * 100)}%
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
                      <p><strong>Move to:</strong> {item.destinationPath}</p>
                      <p><strong>Confidence:</strong> {Math.round(item.confidence * 100)}%</p>
                      <p><strong>Summary:</strong> {item.summary ?? "No summary"}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1"
                          onClick={() => setOpenSuggestionFor((state) => (state === item.id ? null : item.id))}
                        >
                          Suggest Name
                        </Button>
                        <span>
                          {item.suggestedName ? (
                            <>Suggested name: <strong>{item.suggestedName}</strong></>
                          ) : (
                            <>No recommendation</>
                          )}
                        </span>
                      </div>

                      {openSuggestionFor === item.id && (
                        <div className="flex flex-wrap gap-2">
                          {item.suggestedNames.length > 0 ? (
                            <>
                              {item.suggestedNames.map((name) => (
                                <Button
                                  key={name}
                                  size="sm"
                                  variant={item.suggestedName === name ? "default" : "outline"}
                                  className="h-7"
                                  onClick={() => applySuggestedName(item.id, name)}
                                >
                                  {name}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7"
                                onClick={() => applySuggestedName(item.id, null)}
                              >
                                Use Original
                              </Button>
                            </>
                          ) : (
                            <span className="text-muted-foreground">No recommendation</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="flex gap-2">
                  <Button className="gap-2" onClick={toggleMoveAll}>
                    <Sparkles className="h-4 w-4" /> {allMoved ? "Undo All" : "Move All Files"}
                  </Button>
                  <Button variant="outline" onClick={() => void handleAddFiles()}>Add More Files</Button>
                  <Button variant="outline" onClick={() => setOpenSettingsWindow(true)}>Manage Categories</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setItems([]); setMovedItemIds([]); }}>Clear All</Button>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Close</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <SettingsManagementDialogs
        open={openSettingsWindow}
        sections={["default-folder", "categories"]}
        onClose={() => setOpenSettingsWindow(false)}
      />
    </>
  );
}
