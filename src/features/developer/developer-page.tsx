import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";
import { useLogStore } from "@/stores/use-log-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";

export function DeveloperPage() {
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const lastScanTime = useAutomationStore((state) => state.lastScanTime);
  const categories = useCategoryStore((state) => state.categories);
  const rules = useRuleStore((state) => state.categoryToFolderMap);
  const logs = useLogStore((state) => state.logs);
  const exclusionPatterns = usePrivacyStore((state) => state.exclusionPatterns);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Developer</h2>
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
                privacy: exclusionPatterns,
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
