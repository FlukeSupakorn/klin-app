import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrivacyStore } from "@/stores/use-privacy-store";

export function PrivacyPage() {
  const [pattern, setPattern] = useState("");
  const { exclusionPatterns, addPattern, removePattern } = usePrivacyStore();

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Privacy</h2>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Exclusions</p>
            <h3 className="font-black">Exclusion Patterns</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {exclusionPatterns.length} pattern{exclusionPatterns.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="e.g. *.private, secret_*"
            className="border-border bg-muted"
            onKeyDown={(e) => {
              if (e.key === "Enter" && pattern.trim()) {
                addPattern(pattern.trim());
                setPattern("");
              }
            }}
          />
          <Button onClick={() => { if (!pattern.trim()) return; addPattern(pattern.trim()); setPattern(""); }}>
            Add
          </Button>
        </div>

        <div className="space-y-2">
          {exclusionPatterns.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No exclusion patterns. Files matching patterns will be skipped.
            </div>
          ) : (
            exclusionPatterns.map((item) => (
              <div key={item} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-mono text-foreground">{item}</span>
                <button
                  type="button"
                  onClick={() => removePattern(item)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
