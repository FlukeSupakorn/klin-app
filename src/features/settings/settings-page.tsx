import { useState } from "react";
import { Settings, Shield, Brain, Cpu, Trash2, Plus, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePrivacyStore } from "@/stores/use-privacy-store";

export function SettingsPage() {
  const { exclusionPatterns, addPattern, removePattern } = usePrivacyStore();
  const [newPattern, setNewPattern] = useState("");

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-4xl font-semibold tracking-tight text-foreground">Settings</h2>
        <p className="text-muted-foreground mt-1">Configure global application preferences and privacy rules.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-8">
          <Card className="border-0 bg-muted/40 shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Shield className="h-5 w-5" />
                </div>
                <CardTitle>Privacy & Security</CardTitle>
              </div>
              <CardDescription>Exclude specific files or paths from being processed by AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. .git, node_modules, sensitive" 
                  value={newPattern} 
                  onChange={(e) => setNewPattern(e.target.value)}
                  className="bg-background"
                />
                <Button onClick={() => {
                  if (!newPattern.trim()) return;
                  addPattern(newPattern.trim());
                  setNewPattern("");
                }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {exclusionPatterns.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-4 bg-background/50 rounded-xl">No exclusion patterns defined.</p>
                ) : (
                  exclusionPatterns.map((pattern) => (
                    <div key={pattern} className="flex items-center justify-between rounded-xl bg-background p-3 border border-border/50">
                      <span className="text-sm font-medium">{pattern}</span>
                      <Button variant="ghost" size="sm" onClick={() => removePattern(pattern)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-primary/5 shadow-none">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                  <Brain className="h-5 w-5" />
                </div>
                <CardTitle>AI Model</CardTitle>
              </div>
              <CardDescription>Configuration for the classification engine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-2xl bg-background border border-primary/10 space-y-3">
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">Model Provider</span>
                    <Badge variant="outline" className="bg-primary/5 text-primary">Mock Strategy</Badge>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">Min Confidence</span>
                    <span className="text-sm text-muted-foreground">15%</span>
                 </div>
                 <Button variant="secondary" className="w-full text-xs font-bold uppercase tracking-wider h-8" disabled>
                   Switch to OpenAI
                 </Button>
              </div>
              <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-xl text-[11px] text-primary leading-tight">
                <Info className="h-4 w-4 shrink-0" />
                Currently using Mock Strategy for high-performance offline classification.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-0 bg-muted/40 shadow-none h-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-foreground/10 text-foreground flex items-center justify-center">
                  <Cpu className="h-5 w-5" />
                </div>
                <CardTitle>System Information</CardTitle>
              </div>
              <CardDescription>Global application state and runtime information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                 <div className="p-4 rounded-3xl bg-background border border-border/50">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">App Version</p>
                    <p className="text-xl font-bold">v1.2.0-beta</p>
                 </div>
                 <div className="p-4 rounded-3xl bg-background border border-border/50">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Runtime</p>
                    <p className="text-xl font-bold">Tauri / React</p>
                 </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border/50">
                   <div className="space-y-1">
                      <p className="font-bold">Automatic Updates</p>
                      <p className="text-xs text-muted-foreground">Keep the app updated with latest features.</p>
                   </div>
                   <Badge className="bg-green-500 hover:bg-green-600">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border/50 opacity-60">
                   <div className="space-y-1">
                      <p className="font-bold">Dark Mode</p>
                      <p className="text-xs text-muted-foreground">Locked to Light Theme by design system.</p>
                   </div>
                   <Badge variant="outline">Disabled</Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-border/50">
                   <div className="space-y-1">
                      <p className="font-bold">Debug Logs</p>
                      <p className="text-xs text-muted-foreground">Verbose output for troubleshooting.</p>
                   </div>
                   <Badge variant="outline">Disabled</Badge>
                </div>
              </div>

              <div className="pt-6 border-t border-border/50 flex flex-col gap-3">
                 <Button variant="outline" className="justify-start gap-3 rounded-2xl h-12">
                   <History className="h-4 w-4" /> Reset Application Database
                 </Button>
                 <Button variant="destructive" className="justify-start gap-3 rounded-2xl h-12">
                   <Trash2 className="h-4 w-4" /> Factory Reset
                 </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
