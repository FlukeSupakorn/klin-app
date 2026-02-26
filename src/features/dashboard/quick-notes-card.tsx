import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}

export function QuickNotesCard() {
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const addNote = () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      return;
    }

    setNotes((current) => [
      {
        id: crypto.randomUUID(),
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setNoteDraft("");
    setNoteComposerOpen(false);
  };

  return (
    <Card className="rounded-3xl border-0 bg-muted/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">Quick Notes</CardTitle>
        <CardDescription>Click the box to add a note.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!noteComposerOpen ? (
          <button
            type="button"
            onClick={() => setNoteComposerOpen(true)}
            className="w-full rounded-2xl border-2 border-dashed border-border bg-background/60 p-4 text-left text-sm text-muted-foreground transition-colors hover:bg-background"
          >
            + Click to add note
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-background p-3">
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Write your note..."
              className="min-h-[84px] w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setNoteComposerOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={addNote}>
                Add Note
              </Button>
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.slice(0, 3).map((note) => (
              <div key={note.id} className="rounded-xl bg-background p-3">
                <p className="text-sm leading-relaxed">{note.text}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
