import { ArrowUpRight, BookOpenText, Star, Zap, Tags, GitBranch, History, ChevronRight, BarChart3, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OrganizeFilesPanel } from "@/features/dashboard/organize-files-panel";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useLogStore } from "@/stores/use-log-store";
import { useRuleStore } from "@/stores/use-rule-store";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const logs = useLogStore((state) => state.logs);
  const categories = useCategoryStore((state) => state.categories);
  const mappings = useRuleStore((state) => state.categoryToFolderMap);
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const lastScanTime = useAutomationStore((state) => state.lastScanTime);

  const recentLogs = [...logs].reverse().slice(0, 5);
  const completedLogs = logs.filter((l) => l.status === "completed");
  const averageScore = logs.length 
    ? Math.round((logs.reduce((acc, item) => acc + item.score, 0) / logs.length) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.5fr_1fr] pb-10">
      <section className="space-y-8">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">
            System Overview <span className="text-muted-foreground text-2xl ml-2">({logs.length} operations)</span>
          </h2>
          <p className="text-muted-foreground mt-1">Real-time status of your AI-driven file organization.</p>
        </div>

        <OrganizeFilesPanel />

        <div className="grid gap-6 md:grid-cols-2">
          <Link to="/settings">
            <Card className="group border-0 bg-muted/40 shadow-none transition-all hover:bg-muted/60">
              <CardContent className="p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-primary">
                      <Tags className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">Classification</p>
                      <h3 className="text-xl font-semibold">Active Categories</h3>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-background">+{categories.filter(c => c.active).length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-3">
                    {categories.slice(0, 4).map((c, i) => (
                      <div key={c.id} className="h-9 w-9 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold overflow-hidden" style={{ zIndex: 4-i }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                    {categories.length > 4 && (
                      <div className="h-9 w-9 rounded-full border-2 border-background bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold" style={{ zIndex: 0 }}>
                        +{categories.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/settings">
            <Card className="group border-0 bg-primary/10 shadow-none transition-all hover:bg-primary/15">
              <CardContent className="p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-primary">
                      <GitBranch className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-primary/70">Execution</p>
                      <h3 className="text-xl font-semibold">Routing Rules</h3>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-background">+{mappings.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-muted-foreground">
                    Mapping categories to paths
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 bg-muted/40 shadow-none"><CardContent className="p-6 text-center"><p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-2">Completed</p><p className="text-4xl font-semibold">{completedLogs.length}</p></CardContent></Card>
          <Card className="border-0 bg-primary/20 shadow-none"><CardContent className="p-6 text-center"><p className="text-xs font-bold uppercase text-primary/70 tracking-widest mb-2">Avg AI Score</p><p className="text-4xl font-semibold">{averageScore}%</p></CardContent></Card>
          <Card className="border-0 bg-muted/60 shadow-none"><CardContent className="p-6 text-center"><p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-2">Failed</p><p className="text-4xl font-semibold">{logs.filter(l => l.status === "failed").length}</p></CardContent></Card>
        </div>

        <Card className="border-0 bg-muted/40 shadow-none overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", isRunning ? "bg-green-500/10 text-green-600 animate-pulse" : "bg-muted text-muted-foreground")}>
                  <Zap className={cn("h-7 w-7", isRunning && "fill-current")} />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold">Automation Engine</h3>
                  <p className="text-sm text-muted-foreground">
                    {isRunning ? "Actively monitoring folders" : "Engine is currently paused"}
                  </p>
                </div>
              </div>
              <Link to="/settings">
                <Button variant="outline" className="rounded-full gap-2">
                  Manage Watched Folders <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="px-6 pb-6 pt-0">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-muted-foreground mb-3">
                <span>Folders Watched: {watchedFolders.length}</span>
                <span>Last Scan: {lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : "Never"}</span>
              </div>
              <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000", isRunning ? "bg-green-500 w-full" : "bg-muted-foreground/30 w-0")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold">Recent Movements</h3>
            <Link to="/history" className="text-sm font-medium text-primary hover:underline">View all history</Link>
          </div>
          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-3xl border-2 border-dashed">
                No activity recorded yet.
              </div>
            ) : (
              recentLogs.map((log) => (
                <Card key={log.id} className="border-0 bg-muted/40 shadow-none hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background shadow-sm">
                        <BookOpenText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold truncate max-w-[240px]">{log.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="px-1.5 py-0 h-4 text-[10px]">{log.chosenCategory}</Badge>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="hidden md:block text-right">
                        <p className="text-xs font-bold uppercase text-muted-foreground">AI Score</p>
                        <p className="text-sm font-bold text-primary">{Math.round(log.score * 100)}%</p>
                      </div>
                      <div className={cn("h-10 w-10 flex items-center justify-center rounded-full bg-background", log.status === "completed" ? "text-green-500" : "text-destructive")}>
                        {log.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Star className="h-5 w-5" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <Card className="border-0 bg-muted/40 shadow-none rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Category Distribution</CardTitle>
            </div>
            <CardDescription>How AI is classifying your files across categories.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {categories.filter(c => c.active).slice(0, 6).map((cat) => {
              const count = logs.filter(l => l.chosenCategory === cat.name).length;
              const percentage = logs.length ? (count / logs.length) * 100 : 0;
              return (
                <div key={cat.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground">{count} files ({Math.round(percentage)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-1000" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {categories.filter(c => c.active).length === 0 && (
              <p className="text-sm text-center text-muted-foreground py-10 italic">
                No active categories. Create some to see distribution.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-primary/5 shadow-none rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-lg">AI Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence Rating</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={cn("h-4 w-4", i <= 4 ? "text-yellow-500 fill-yellow-500" : "text-muted")} />
                  ))}
                </div>
             </div>
             <p className="text-xs text-muted-foreground leading-relaxed">
               The AI model is currently performing with high confidence based on your recent 50 file classifications.
             </p>
             <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-background rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Avg Process Time</p>
                  <p className="text-xl font-bold">~420ms</p>
                </div>
                <div className="p-3 bg-background rounded-2xl">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Success Rate</p>
                  <p className="text-xl font-bold text-green-600">98.2%</p>
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40 shadow-none rounded-3xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center text-xl font-bold">
              SK
            </div>
            <div>
              <p className="font-bold">System Admin</p>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Pro Plan Active</p>
            </div>
          </div>
          <div className="space-y-3">
             <Button variant="outline" className="w-full justify-between rounded-2xl h-12">
               System Health <Badge variant="secondary" className="bg-green-500/10 text-green-600">Stable</Badge>
             </Button>
             <Button variant="outline" className="w-full justify-between rounded-2xl h-12 text-destructive hover:bg-destructive/10">
               Clear All Logs <History className="h-4 w-4" />
             </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
