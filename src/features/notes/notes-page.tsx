import { useState } from "react";
import MDEditor, { commands } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { cn } from "@/lib/utils";

type EditorMode = "write" | "preview";

export function NotesPage() {
  const [value, setValue] = useState(
    "# Automation Notes\n\nTrack rule and category tuning here.\n\n## Categories\n\n- Add notes about your active categories\n- Document any custom rules\n\n## Tips\n\nUse **bold** for important items and `inline code` for file paths.",
  );
  const [mode, setMode] = useState<EditorMode>("write");

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Documents
        </p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Notes</h2>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setMode("write")}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-colors",
                mode === "write"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-colors",
                mode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Preview
            </button>
          </div>
        </div>

        <div data-color-mode="dark" className="notes-editor">
          {mode === "write" ? (
            <MDEditor
              value={value}
              onChange={(val) => setValue(val ?? "")}
              preview="edit"
              hideToolbar={false}
              height={420}
              commands={[
                commands.bold,
                commands.italic,
                commands.strikethrough,
                commands.divider,
                commands.title1,
                commands.title2,
                commands.title3,
                commands.divider,
                commands.unorderedListCommand,
                commands.orderedListCommand,
                commands.checkedListCommand,
                commands.divider,
                commands.code,
                commands.codeBlock,
                commands.link,
                commands.quote,
              ]}
              extraCommands={[]}
            />
          ) : (
            <div className="min-h-[420px] px-5 py-4">
              <MDEditor.Markdown
                source={value}
                style={{ backgroundColor: "transparent", color: "inherit" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
