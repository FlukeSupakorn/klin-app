import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationStore } from "@/stores/use-automation-store";

export function FileHealthPage() {
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">File Health</h2>
      <Card>
        <CardHeader><CardTitle>Watcher Coverage</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Total watched folders: {watchedFolders.length}</p>
          {watchedFolders.map((folder) => (
            <p key={folder} className="rounded-md border p-2">{folder}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
