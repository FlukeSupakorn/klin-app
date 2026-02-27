import { ChevronRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { theme } from "@/theme/theme";

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
    <Card className="overflow-hidden border-0 bg-muted/40 shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                isRunning
                  ? cn("animate-pulse", theme.status.successSurface, theme.status.successMutedText)
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Zap className={cn("h-7 w-7", isRunning && "fill-current")} />
            </div>
            <div>
              <h3 className="text-2xl font-semibold">Automation Engine</h3>
              <p className="text-sm text-muted-foreground">{isRunning ? "Watching folders" : "Paused"}</p>
            </div>
          </div>
          <Link to="/settings">
            <Button variant="outline" className="gap-2 rounded-full">
              Manage Watched Folders <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="px-6 pb-6 pt-0">
          <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase text-muted-foreground">
            <span>Folders Watched: {watchedFoldersCount}</span>
            <span>Last Scan: {lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : "Never"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                isRunning ? cn("w-full", theme.status.successText) : "w-0 bg-muted-foreground/30",
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
