import { Pencil } from "lucide-react";
import type { HistoryEntry } from "@/types/history";

interface HistoryOrganizeDetailsProps {
  entry: Extract<HistoryEntry, { type: "organize" }>;
  onRequestEditMovedTo: (entryId: string) => void;
}

export function HistoryOrganizeDetails({ entry, onRequestEditMovedTo }: HistoryOrganizeDetailsProps) {
  const isRenamed = entry.oldName !== entry.newName;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {/* From */}
        <div
          className="rounded-[12px] border p-3"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            From
          </div>
          <div
            className="truncate text-[11.5px] text-foreground"
            style={{ fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.5, wordBreak: "break-all" }}
            title={entry.fromPath}
          >
            {entry.fromPath}
          </div>
        </div>

        {/* Moved To */}
        <div
          className="relative rounded-[12px] border p-3"
          style={{ background: "var(--card)", borderColor: "rgba(74,124,247,0.2)" }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
              Moved To
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRequestEditMovedTo(entry.id); }}
              className="flex items-center gap-1 rounded-[7px] px-2 py-0.5 text-[11px] font-bold text-primary transition-colors hover:opacity-70"
              style={{ background: "rgba(74,124,247,0.10)" }}
            >
              <Pencil className="h-2.5 w-2.5" />
              Edit
            </button>
          </div>
          <div
            className="truncate text-[11.5px] text-primary"
            style={{ fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.5, wordBreak: "break-all" }}
            title={entry.toPath}
          >
            {entry.toPath}
          </div>
        </div>
      </div>

      {/* Rename */}
      <div
        className="rounded-[12px] border p-3"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
          Rename
        </div>
        <div className="text-[12.5px]">
          {isRenamed ? (
            <>
              <span className="text-muted-foreground">{entry.oldName}</span>
              <span className="mx-2 text-muted-foreground/50">→</span>
              <span className="font-bold text-foreground">{entry.newName}</span>
            </>
          ) : (
            <span className="italic text-muted-foreground">No rename</span>
          )}
        </div>
      </div>
    </div>
  );
}
