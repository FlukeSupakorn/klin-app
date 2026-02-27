import { useState } from "react";
import { FileText, FolderOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notesApiService } from "@/services/notes-api-service";
import { tauriClient } from "@/services/tauri-client";

interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
  sourceFiles: string[];
  suggestedFolders: string[];
  titleSuggestion: string;
  savedPath: string | null;
}

export function QuickNotesCard() {
  const [noteComposerOpen, setNoteComposerOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [suggestedFoldersDraft, setSuggestedFoldersDraft] = useState<string[]>([]);
  const [titleSuggestionDraft, setTitleSuggestionDraft] = useState("Quick-Note");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savePendingId, setSavePendingId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const buildNoteFileName = (title: string) => {
    const normalized = title
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 48);
    const fallback = normalized || "Quick-Note";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${fallback}-${stamp}`;
  };

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
        sourceFiles: selectedFiles,
        suggestedFolders: suggestedFoldersDraft,
        titleSuggestion: titleSuggestionDraft,
        savedPath: null,
      },
      ...current,
    ]);
    setNoteDraft("");
    setSelectedFiles([]);
    setSuggestedFoldersDraft([]);
    setTitleSuggestionDraft("Quick-Note");
    setNoteError(null);
    setNoteComposerOpen(false);
  };

  const handleGenerateFromFiles = async () => {
    try {
      setIsGenerating(true);
      setNoteError(null);

      const files = await tauriClient.pickFilesForOrganize();
      if (files.length === 0) {
        setIsGenerating(false);
        return;
      }

      setSelectedFiles(files);
      const response = await notesApiService.summarizeFromFiles(files);

      setNoteDraft(response.summary);
      setSuggestedFoldersDraft(response.suggestedFolders);
      setTitleSuggestionDraft(response.titleSuggestion);
      setNoteComposerOpen(true);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Failed to summarize files");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveNoteToFolder = async (noteId: string, folderPath: string) => {
    const target = notes.find((item) => item.id === noteId);
    if (!target) {
      return;
    }

    try {
      setSavePendingId(noteId);
      setNoteError(null);
      const savedPath = await tauriClient.saveNoteFile({
        folderPath,
        fileName: buildNoteFileName(target.titleSuggestion),
        content: target.text,
      });

      setNotes((current) =>
        current.map((note) => (note.id === noteId ? { ...note, savedPath } : note)),
      );
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Failed to save note");
    } finally {
      setSavePendingId(null);
    }
  };

  const handlePickFolderForSave = async (noteId: string) => {
    const folder = await tauriClient.pickFolderForOrganize();
    if (!folder) {
      return;
    }

    await saveNoteToFolder(noteId, folder);
  };

  return (
    <Card className="rounded-3xl border-0 bg-muted/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-lg">Quick Notes</CardTitle>
        <CardDescription>Add manually or auto-fill from selected files.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNoteComposerOpen(true)}>
            <FileText className="h-3.5 w-3.5" /> Add note
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleGenerateFromFiles()} disabled={isGenerating}>
            <Sparkles className="h-3.5 w-3.5" /> {isGenerating ? "Generating..." : "AI from files"}
          </Button>
        </div>

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
            {selectedFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedFiles.length} file(s) selected for AI summary</p>
            )}
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

        {noteError && <p className="text-xs text-destructive">{noteError}</p>}

        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.slice(0, 3).map((note) => (
              <div key={note.id} className="rounded-xl bg-background p-3">
                <p className="text-sm leading-relaxed">{note.text}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString()}
                </p>

                {note.savedPath && (
                  <p className="mt-1 text-[11px] text-primary">Saved: {note.savedPath}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {note.suggestedFolders.map((folder) => (
                    <Button
                      key={`${note.id}-${folder}`}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => void saveNoteToFolder(note.id, folder)}
                      disabled={savePendingId === note.id}
                    >
                      Save → {folder.split(/[\\/]/).filter(Boolean).at(-1)}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => void handlePickFolderForSave(note.id)}
                    disabled={savePendingId === note.id}
                  >
                    <FolderOpen className="h-3 w-3" /> Choose folder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
