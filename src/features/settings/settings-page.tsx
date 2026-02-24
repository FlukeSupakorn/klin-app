import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>
      <Card>
        <CardHeader><CardTitle>Application Settings</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Single design system mode is enabled.</p>
          <p>Theme switching is intentionally disabled by architecture.</p>
          <p>Automation-first operation is active.</p>
        </CardContent>
      </Card>
    </div>
  );
}
