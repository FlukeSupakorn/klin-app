import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useLogStore } from "@/stores/use-log-store";
import { useRuleStore } from "@/stores/use-rule-store";

export function DashboardPage() {
  const logs = useLogStore((state) => state.logs);
  const categories = useCategoryStore((state) => state.categories);
  const mappings = useRuleStore((state) => state.categoryToFolderMap);
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const lastScanTime = useAutomationStore((state) => state.lastScanTime);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Automation Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle>Total Logs</CardTitle></CardHeader><CardContent>{logs.length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Active Categories</CardTitle></CardHeader><CardContent>{categories.filter((c) => c.active).length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Rule Mappings</CardTitle></CardHeader><CardContent>{mappings.length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Watched Folders</CardTitle></CardHeader><CardContent>{watchedFolders.length}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Automation Status</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Engine: {isRunning ? "Running" : "Stopped"}</p>
          <p>Last scan: {lastScanTime ?? "N/A"}</p>
          <p>Pipeline: Detection → AI scoring → Rule mapping → Move → Persist log</p>
        </CardContent>
      </Card>
    </div>
  );
}
