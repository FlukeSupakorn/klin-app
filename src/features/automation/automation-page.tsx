import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AsyncProcessingQueue } from "@/services/automation-queue";
import { processAutomationJob } from "@/services/automation-service";
import { tauriClient } from "@/services/tauri-client";
import { useAutomationStore } from "@/stores/use-automation-store";

export function AutomationPage() {
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const addWatchedFolder = useAutomationStore((state) => state.addWatchedFolder);
  const setRunning = useAutomationStore((state) => state.setRunning);
  const concurrencyLimit = useAutomationStore((state) => state.concurrencyLimit);
  const setConcurrencyLimit = useAutomationStore((state) => state.setConcurrencyLimit);
  const setLastScanTime = useAutomationStore((state) => state.setLastScanTime);
  const queueRef = useRef(new AsyncProcessingQueue(concurrencyLimit));

  useEffect(() => {
    queueRef.current.setConcurrency(concurrencyLimit);
  }, [concurrencyLimit]);

  const runScanCycle = async () => {
    if (!isRunning || watchedFolders.length === 0) {
      return;
    }

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

  const runningLabel = useMemo(() => (isRunning ? "Stop Automation" : "Start Automation"), [isRunning]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Automation</h2>
      <Card>
        <CardHeader><CardTitle>Engine Control</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button onClick={() => setRunning(!isRunning)}>{runningLabel}</Button>
            <span className="text-sm text-muted-foreground">{isRunning ? "Running in background" : "Stopped"}</span>
          </div>
          <div className="flex max-w-sm items-center gap-2">
            <Input
              type="number"
              min={1}
              value={concurrencyLimit}
              onChange={(event) => setConcurrencyLimit(Number(event.target.value) || 1)}
            />
            <span className="text-sm">Concurrency</span>
          </div>
          <Button variant="outline" onClick={() => void runScanCycle()}>
            Run Scan Cycle
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Watched Folders</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {watchedFolders.map((folder) => (
            <div key={folder} className="rounded-md border p-3 text-sm">{folder}</div>
          ))}
          <Button variant="outline" onClick={async () => addWatchedFolder(await tauriClient.getDownloadsFolder())}>Add Downloads Folder</Button>
        </CardContent>
      </Card>
    </div>
  );
}
