import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";
import { useHistoryStore } from "@/stores/use-history-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";

export function DeveloperPage() {
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const lastScanTime = useAutomationStore((state) => state.lastScanTime);
  const categories = useCategoryStore((state) => state.categories);
  const rules = useRuleStore((state) => state.categoryToFolderMap);
  const logs = useHistoryStore((state) => state.logs);
  const lockedPaths = usePrivacyStore((state) => state.lockedPaths);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Internal</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Developer</h2>
      </div>
      <Card>
        <CardHeader><CardTitle>State Snapshot</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md border p-3 text-xs">
            {JSON.stringify(
              {
                automation: {
                  watchedFolders,
                  isRunning,
                  lastScanTime,
                },
                categories,
                rules,
                logCount: logs.length,
                privacy: lockedPaths,
              },
              null,
              2,
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
