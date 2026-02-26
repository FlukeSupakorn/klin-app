import { BookOpenText, CheckCircle2, Clock, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AutomationLog } from "@/types/domain";

interface RecentMovementsSectionProps {
  recentLogs: AutomationLog[];
}

export function RecentMovementsSection({ recentLogs }: RecentMovementsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold">Recent Movements</h3>
        <Link to="/history" className="text-sm font-medium text-primary hover:underline">
          View all history
        </Link>
      </div>
      <div className="space-y-3">
        {recentLogs.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed bg-muted/20 py-12 text-center text-muted-foreground">
            No activity recorded yet.
          </div>
        ) : (
          recentLogs.map((log) => (
            <Card key={log.id} className="border-0 bg-muted/40 shadow-none transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background shadow-sm">
                    <BookOpenText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="max-w-[240px] truncate font-semibold">{log.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px]">
                        {log.chosenCategory}
                      </Badge>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden text-right md:block">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Score</p>
                    <p className="text-sm font-bold text-primary">{Math.round(log.score * 100)}%</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-background",
                      log.status === "completed" ? "text-green-500" : "text-destructive",
                    )}
                  >
                    {log.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Star className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
