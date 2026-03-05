import { HeartPulse } from "lucide-react";
import { useAutomationStore } from "@/stores/use-automation-store";

export function FileHealthPage() {
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monitoring</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">File Health</h2>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Coverage</p>
            <h3 className="font-black">Watcher Coverage</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {watchedFolders.length} folder{watchedFolders.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {watchedFolders.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No folders being watched. Add folders in Automation settings.
            </div>
          ) : (
            watchedFolders.map((folder) => (
              <div key={folder} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-mono">{folder}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
