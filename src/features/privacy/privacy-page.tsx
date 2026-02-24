import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePrivacyStore } from "@/stores/use-privacy-store";

export function PrivacyPage() {
  const [pattern, setPattern] = useState("");
  const { exclusionPatterns, addPattern, removePattern } = usePrivacyStore();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Privacy</h2>
      <Card>
        <CardHeader><CardTitle>Exclusion Patterns</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="Pattern" />
            <Button onClick={() => { if (!pattern.trim()) return; addPattern(pattern.trim()); setPattern(""); }}>Add</Button>
          </div>
          {exclusionPatterns.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{item}</span>
              <Button variant="ghost" size="sm" onClick={() => removePattern(item)}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
