import { Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AutomationEngineCardProps {
  isRunning: boolean;
  watchedFoldersCount: number;
  lastScanTime: string | null;
}

export function AutomationEngineCard({
  isRunning,
  watchedFoldersCount,
  lastScanTime,
}: AutomationEngineCardProps) {
  return (
    <Card className="border border-border bg-card shadow-none">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Automation</p>
            <h3 className="mt-0.5 text-lg font-black text-foreground">Engine</h3>
          </div>
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
            isRunning ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}>
            <Zap className={cn("h-5 w-5", isRunning && "fill-primary")} />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            isRunning ? "animate-pulse bg-primary" : "bg-muted-foreground/40",
          )} />
          <span className={cn(
            "text-sm font-bold",
            isRunning ? "text-primary" : "text-muted-foreground",
          )}>
            {isRunning ? "Running" : "Paused"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Folders</p>
            <p className="text-xl font-black text-secondary">{watchedFoldersCount}</p>
          </div>
          <div className="rounded-xl bg-muted px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Last Scan</p>
            <p className="truncate text-xs font-bold text-foreground">
              {lastScanTime ? new Date(lastScanTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never"}
            </p>
          </div>
        </div>

        <Link
          to="/automation"
          className="mt-3 block text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
        >
          Manage →
        </Link>
      </CardContent>
    </Card>
  );
}
