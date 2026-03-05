import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, Play, Square, Settings2, FolderPlus, FolderSearch, Clock, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AsyncProcessingQueue } from "@/services/automation-queue";
import { processAutomationJob } from "@/services/automation-service";
import { tauriClient } from "@/services/tauri-client";
import { useAutomationStore } from "@/stores/use-automation-store";
import { cn } from "@/lib/utils";

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


  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Engine</p>
          <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Automation</h2>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
          <Zap className={cn("h-4 w-4", isRunning ? "text-primary fill-current" : "text-muted-foreground")} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
            <p className="text-sm font-black">{isRunning ? "Active" : "Idle"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Control</p>
              <h3 className="font-black">Engine Control</h3>
            </div>
            <Badge variant={isRunning ? "default" : "outline"} className={cn(isRunning ? "bg-primary/15 text-primary border-primary/30" : "")}>
              {isRunning ? "Running" : "Stopped"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              onClick={() => setRunning(!isRunning)}
              variant={isRunning ? "destructive" : "default"}
              className="min-w-[180px] gap-2"
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
              <RefreshCw className="h-4 w-4" /> Manual Scan
            </Button>
          </div>

          <div className="flex items-center gap-8 border-t border-border pt-4">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Settings2 className="h-3 w-3" /> Concurrency
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={concurrencyLimit}
                  onChange={(event) => setConcurrencyLimit(Number(event.target.value) || 1)}
                  className="w-20 border-border bg-muted"
                />
                <span className="text-xs text-muted-foreground">Simultaneous files</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Clock className="h-3 w-3" /> Last Scan
              </label>
              <p className="flex h-10 items-center text-sm font-bold">
                {lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : "Never"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shortcuts</p>
            <h3 className="flex items-center gap-2 font-black">
              <FolderSearch className="h-4 w-4 text-primary" /> Quick Add
            </h3>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-border bg-card hover:border-primary/30"
            onClick={async () => addWatchedFolder(await tauriClient.getDownloadsFolder())}
          >
            <FolderPlus className="h-4 w-4 text-primary" /> Downloads Folder
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-border bg-card hover:border-primary/30"
            onClick={async () => addWatchedFolder("C:/Users/User/Desktop")}
          >
            <FolderPlus className="h-4 w-4 text-primary" /> Desktop Folder
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monitoring</p>
          <h3 className="font-black">Watched Folders</h3>
        </div>

        <div className="flex gap-2">
          <Input
            value={newFolderPath}
            onChange={(e) => setNewFolderPath(e.target.value)}
            placeholder="Enter folder path..."
            className="border-border bg-muted"
          />
          <Button
            onClick={() => {
              if (!newFolderPath.trim()) return;
              addWatchedFolder(newFolderPath.trim());
              setNewFolderPath("");
            }}
          >
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {watchedFolders.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No folders being watched yet.
            </div>
          ) : (
            watchedFolders.map((folder) => (
              <div key={folder} className="group flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <FolderSearch className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium">{folder}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Watch</p>
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
      </div>
    </div>
  );
}
