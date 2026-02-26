import { useState } from "react";
import { FolderOpen, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MockOrganizePreviewFactory } from "@/services/mock-organize-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { cn } from "@/lib/utils";
import type { OrganizePreviewItem } from "@/types/domain";

export function OrganizeFilesPanel() {
  const categories = useCategoryManagementStore((state) => state.categories);
  const [items, setItems] = useState<OrganizePreviewItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const openWithPaths = (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }
    setItems(MockOrganizePreviewFactory.fromPaths(paths, categories));
    setModalOpen(true);
  };

  const handleAddFiles = async () => {
    const selected = await tauriClient.pickFilesForOrganize();
    openWithPaths(selected);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer.files).map((file) => `Dropped/${file.name}`);
    openWithPaths(dropped);
  };

  const applyCategory = (itemId: string, categoryName: string) => {
    const category = categories.find((entry) => entry.name === categoryName);
    if (!category) {
      return;
    }

    setItems((state) =>
      state.map((item) =>
        item.id === itemId ? MockOrganizePreviewFactory.applyCategory(item, category) : item,
      ),
    );
  };

  const toggleRename = (itemId: string) => {
    setItems((state) =>
      state.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        return MockOrganizePreviewFactory.toggleRename(item, item.suggestedName === null);
      }),
    );
  };

  return (
    <>
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Organize Files In Program</CardTitle>
          <CardDescription>
            Add files from your computer or drag files into this area to prepare organization with mocked AI recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="rounded-2xl border border-dashed border-border bg-muted/30 p-14 text-center"
          >
            <div className="mb-3 flex justify-center gap-2 text-muted-foreground">
              <FolderOpen className="h-8 w-8" />
              <Upload className="h-8 w-8" />
            </div>
            <p className="text-2xl font-semibold">Add Files to Get Started</p>
            <p className="mt-2 text-sm text-muted-foreground">Drag or click to add files</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => void handleAddFiles()}>Add Files</Button>
              <Button size="sm" variant="outline">Manage Categories</Button>
              <Button size="sm" variant="outline">Quick Actions</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
          <Card className="h-[80vh] w-full max-w-5xl overflow-hidden">
            <CardHeader>
              <CardTitle>Files to organize</CardTitle>
              <CardDescription>{items.length} file(s)</CardDescription>
            </CardHeader>
            <CardContent className="flex h-[calc(80vh-96px)] flex-col gap-4 overflow-hidden">
              <Input placeholder="Search files..." />

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
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => toggleRename(item.id)}>
                          AI Rename
                        </Button>
                        <span>
                          {item.suggestedName ? (
                            <>Suggested name: <strong>{item.suggestedName}</strong></>
                          ) : (
                            <>No recommendation</>
                          )}
                        </span>
                      </div>
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
