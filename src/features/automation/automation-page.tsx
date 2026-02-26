import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, Play, Square, Settings2, FolderPlus, FolderSearch, Clock, RefreshCw, Trash2, Sparkles, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AsyncProcessingQueue } from "@/services/automation-queue";
import { processAutomationJob } from "@/services/automation-service";
import { MockOrganizePreviewFactory } from "@/services/mock-organize-service";
import { tauriClient } from "@/services/tauri-client";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { cn } from "@/lib/utils";
import type { OrganizePreviewItem } from "@/types/domain";

export function AutomationPage() {
  const [newFolderPath, setNewFolderPath] = useState("");
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const addWatchedFolder = useAutomationStore((state) => state.addWatchedFolder);
  const removeWatchedFolder = useAutomationStore((state) => state.removeWatchedFolder);
  const setRunning = useAutomationStore((state) => state.setRunning);
  const concurrencyLimit = useAutomationStore((state) => state.concurrencyLimit);
  const setConcurrencyLimit = useAutomationStore((state) => state.setConcurrencyLimit);
  const lastScanTime = useAutomationStore((state) => state.lastScanTime);
  const setLastScanTime = useAutomationStore((state) => state.setLastScanTime);
  const managedCategories = useCategoryManagementStore((state) => state.categories);

  const [organizeModalOpen, setOrganizeModalOpen] = useState(false);
  const [organizeItems, setOrganizeItems] = useState<OrganizePreviewItem[]>([]);

  const queueRef = useRef(new AsyncProcessingQueue(concurrencyLimit));

  useEffect(() => {
    queueRef.current.setConcurrency(concurrencyLimit);
  }, [concurrencyLimit]);

  const runScanCycle = async () => {
    if (watchedFolders.length === 0) return;

    const scanned = await Promise.all(
      watchedFolders.map((folderPath) => tauriClient.readFolder({ folderPath }).catch(() => [])),
    );

    scanned.flat().forEach((filePath) => {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
      queueRef.current.enqueue(async () => {
        await processAutomationJob({
          filePath,
          fileName,
          contentPreview: "",
        });
      });
    });

    setLastScanTime(new Date().toISOString());
  };

  const openOrganizeModal = () => {
    const next = MockOrganizePreviewFactory.create(managedCategories);
    setOrganizeItems(next);
    setOrganizeModalOpen(true);
  };

  const applyCategorySelection = (itemId: string, categoryName: string) => {
    const category = managedCategories.find((entry) => entry.name === categoryName);
    if (!category) {
      return;
    }

    setOrganizeItems((state) =>
      state.map((item) =>
        item.id === itemId ? MockOrganizePreviewFactory.applyCategory(item, category) : item,
      ),
    );
  };

  const applyAiRename = (itemId: string) => {
    setOrganizeItems((state) =>
      state.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        const enableRename = item.suggestedName === null;
        return MockOrganizePreviewFactory.toggleRename(item, enableRename);
      }),
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">Automation</h2>
          <p className="text-muted-foreground">Configure background monitoring and file processing.</p>
        </div>
        <Card className="flex items-center gap-3 px-4 py-2 shadow-none">
          <Zap className={cn("h-4 w-4", isRunning ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground")} />
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Engine Status</p>
            <p className="text-lg font-semibold">{isRunning ? "Active" : "Idle"}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-0 bg-muted/40 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Engine Control</CardTitle>
                <CardDescription>Manage the background automation process.</CardDescription>
              </div>
              <Badge variant={isRunning ? "default" : "outline"} className={cn(isRunning ? "bg-green-500 hover:bg-green-600" : "")}>
                {isRunning ? "Running" : "Stopped"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg"
                onClick={() => setRunning(!isRunning)} 
                variant={isRunning ? "destructive" : "default"}
                className="gap-2 min-w-[180px]"
              >
                {isRunning ? <><Square className="h-4 w-4 fill-current" /> Stop Engine</> : <><Play className="h-4 w-4 fill-current" /> Start Engine</>}
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                onClick={() => void runScanCycle()}
                className="gap-2"
                disabled={watchedFolders.length === 0}
              >
                <RefreshCw className="h-4 w-4" /> Trigger Manual Scan
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-4 border-t border-border/50">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Settings2 className="h-3 w-3" /> Concurrency Limit
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={concurrencyLimit}
                    onChange={(event) => setConcurrencyLimit(Number(event.target.value) || 1)}
                    className="w-20 bg-background"
                  />
                  <span className="text-sm text-muted-foreground italic">Simultaneous file processing</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" /> Last Scan
                </label>
                <p className="text-sm font-medium h-10 flex items-center">
                  {lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : "Never"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-primary/5 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderSearch className="h-5 w-5 text-primary" /> Quick Add
            </CardTitle>
            <CardDescription>Add common system folders to watch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="secondary" 
              className="w-full justify-start gap-3 bg-background" 
              onClick={async () => addWatchedFolder(await tauriClient.getDownloadsFolder())}
            >
              <FolderPlus className="h-4 w-4 text-primary" /> Downloads Folder
            </Button>
            <Button 
              variant="secondary" 
              className="w-full justify-start gap-3 bg-background"
              onClick={async () => addWatchedFolder("C:/Users/User/Desktop")}
            >
              <FolderPlus className="h-4 w-4 text-primary" /> Desktop Folder
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Watched Folders</CardTitle>
          <CardDescription>The engine monitors these locations for new files to classify.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={newFolderPath} 
              onChange={(e) => setNewFolderPath(e.target.value)}
              placeholder="Enter folder path manually..." 
              className="bg-muted/30"
            />
            <Button 
              onClick={() => {
                if (!newFolderPath.trim()) return;
                addWatchedFolder(newFolderPath.trim());
                setNewFolderPath("");
              }}
            >
              Add Path
            </Button>
          </div>

          <div className="space-y-3">
            {watchedFolders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
                No folders being watched yet.
              </div>
            ) : (
              watchedFolders.map((folder) => (
                <div key={folder} className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <FolderSearch className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">{folder}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Active Watch</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeWatchedFolder(folder)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Organize Files In Program</CardTitle>
            <CardDescription>Manual add files flow with mocked AI category scoring and rename recommendation.</CardDescription>
          </div>
          <Button onClick={openOrganizeModal}>Add Files To Organize</Button>
        </CardHeader>
      </Card>

      {organizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
          <Card className="h-[80vh] w-full max-w-5xl overflow-hidden">
            <CardHeader>
              <CardTitle>Files to organize</CardTitle>
              <CardDescription>Mocked data preview for AI organization workflow.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-[calc(80vh-96px)] flex-col gap-4 overflow-hidden">
              <div className="flex gap-2">
                <Input placeholder="Search files..." />
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {organizeItems.map((item) => (
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
                          onClick={() => applyCategorySelection(item.id, score.name)}
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
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => applyAiRename(item.id)}>
                          <PencilLine className="h-3 w-3" /> AI Rename
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
                  <Button variant="outline">Add More Files</Button>
                  <Button variant="outline">Manage Categories</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOrganizeItems([])}>Clear All</Button>
                  <Button variant="outline" onClick={() => setOrganizeModalOpen(false)}>Close</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
