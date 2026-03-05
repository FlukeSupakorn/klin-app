import { useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@uiw/react-md-editor/markdown-editor.css";

export function NotesPage() {
  const [value, setValue] = useState<string>("# Automation Notes\n\nTrack rule and category tuning here.");

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documents</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Notes</h2>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Editor</p>
          <h3 className="font-black">Markdown Editor</h3>
        </div>
        <MDEditor value={value} onChange={(next) => setValue(next ?? "")} preview="edit" height={320} />
        <div className="rounded-lg border border-border bg-muted/30 p-4 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
