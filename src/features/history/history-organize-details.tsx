import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HistoryEntry } from "@/types/history";

interface HistoryOrganizeDetailsProps {
  entry: Extract<HistoryEntry, { type: "organize" }>;
  onRequestEditMovedTo: (entryId: string) => void;
}

export function HistoryOrganizeDetails({
  entry,
  onRequestEditMovedTo,
}: HistoryOrganizeDetailsProps) {
  const isRenamed = entry.oldName !== entry.newName;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">From</p>
          <p className="truncate font-medium" title={entry.fromPath}>{entry.fromPath}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Moved To</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onRequestEditMovedTo(entry.id)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
          <p className="truncate font-medium" title={entry.toPath}>{entry.toPath}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
        <p className="mb-1 text-xs text-muted-foreground">Rename</p>
        <p className="font-medium">
          {isRenamed ? (
            <>
              <span className="font-normal text-foreground/70">{entry.oldName}</span>
              <span className="px-1.5 text-foreground/50">→</span>
              <span className="font-semibold text-foreground">{entry.newName}</span>
            </>
          ) : (
            "No rename"
          )}
        </p>
      </div>
    </div>
  );
}
