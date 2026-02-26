import { useState } from "react";
import { FolderOpen, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { organizeApiService } from "@/services/organize-api-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { cn } from "@/lib/utils";
import type { OrganizePreviewItem } from "@/types/domain";

export function OrganizeFilesPanel() {
  const categories = useCategoryManagementStore((state) => state.categories);
  const [items, setItems] = useState<OrganizePreviewItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openSuggestionFor, setOpenSuggestionFor] = useState<string | null>(null);

  const openWithPaths = async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const analyzedItems = await organizeApiService.analyze(paths, categories);
      setItems(analyzedItems);
    } catch {
      setErrorMessage("Could not analyze files from API. Make sure your API server is running at localhost:3000 and supports POST /organize or /organize/analyze.");
      setItems([]);
    } finally {
      setIsAnalyzing(false);
    }

    setModalOpen(true);
  };

  const handleAddFiles = async () => {
    const selected = await tauriClient.pickFilesForOrganize();
    await openWithPaths(selected);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer.files).map((file) => {
      const fileWithPath = file as File & { path?: string };
      return fileWithPath.path ?? `Dropped/${file.name}`;
    });
    void openWithPaths(dropped);
  };

  const applyCategory = (itemId: string, categoryName: string) => {
    const category = categories.find((entry) => entry.name === categoryName);
    if (!category) {
      return;
    }

    setItems((state) => {
      return state.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const activeName = item.suggestedName ?? item.fileName;
        return {
          ...item,
          selectedCategory: category.name,
          destinationPath: `${category.folderPath}/${activeName}`,
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

        const folderPath = item.destinationPath.includes("/")
          ? item.destinationPath.slice(0, item.destinationPath.lastIndexOf("/"))
          : item.destinationPath;

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

  return (
    <>
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardContent>
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
            className="cursor-pointer rounded-2xl border border-dashed border-border bg-muted/30 p-14 text-center"
          >
            <div className="mb-3 flex justify-center gap-2 text-muted-foreground">
              <FolderOpen className="h-8 w-8" />
              <Upload className="h-8 w-8" />
            </div>
            <p className="text-2xl font-semibold">Add Files to Get Started</p>
            <p className="mt-2 text-sm text-muted-foreground">Drag or click to add files</p>
          </div>
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
          <Card className="h-[80vh] w-full max-w-5xl overflow-hidden">
            <CardHeader>
              <CardTitle>Files to organize</CardTitle>
              <CardDescription>
                {isAnalyzing ? "Analyzing with AI API..." : `${items.length} file(s)`}
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
                  Sending file paths to API and waiting for recommendations...
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
                      <Button size="sm">Move</Button>
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
                      <p><strong>AI confidence:</strong> {Math.round(item.confidence * 100)}%</p>
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
                  <Button className="gap-2"><Sparkles className="h-4 w-4" /> Move All Files</Button>
                  <Button variant="outline" onClick={() => void handleAddFiles()}>Add More Files</Button>
                  <Button variant="outline">Manage Categories</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setItems([])}>Clear All</Button>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Close</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
