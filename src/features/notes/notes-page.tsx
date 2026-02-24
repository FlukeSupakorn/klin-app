import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "@uiw/react-md-editor/markdown-editor.css";

export function NotesPage() {
  const [value, setValue] = useState<string>("# Automation Notes\n\nTrack rule and category tuning here.");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Notes</h2>
      <Card>
        <CardHeader><CardTitle>Markdown Editor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <MDEditor value={value} onChange={(next) => setValue(next ?? "")} preview="edit" height={320} />
          <div className="rounded-md border p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
