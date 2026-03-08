import { useEffect, useMemo, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { ArrowLeft, FilePlus2, Files, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { notesApiService } from "@/services/notes-api-service";
import { notesFileService, type NoteFileItem } from "@/services/notes-file-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";

type NotesView = "list" | "editor";

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Unknown";
  }

  return new Date(ms).toLocaleString();
}

function stripMdSuffix(fileName: string): string {
  return fileName.toLowerCase().endsWith(".md") ? fileName.slice(0, -3) : fileName;
}

function createTemplate(title: string): string {
  return `# ${title}\n\nWrite your note here.\n`;
}

function createDefaultTitle(prefix = "Quick-Note"): string {
  return `${prefix}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;
}

export function NotesPage() {
  const categories = useCategoryManagementStore((state) => state.categories);

  const [view, setView] = useState<NotesView>("list");
  const [notes, setNotes] = useState<NoteFileItem[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [title, setTitle] = useState(createDefaultTitle());
  const [content, setContent] = useState(createTemplate("Quick Note"));
  const [activePath, setActivePath] = useState<string | null>(null);
  const [appNotesPath, setAppNotesPath] = useState<string>("");
  const [summarySourceFiles, setSummarySourceFiles] = useState<string[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.enabled && category.folderPath.trim().length > 0),
    [categories],
  );

  const refreshNotes = async () => {
    setIsLoadingNotes(true);
    setNotesError(null);

    try {
      const [noteRows, appFolder] = await Promise.all([
        notesFileService.listAppNotes(),
        notesFileService.getAppNotesFolderPath(),
      ]);
      setNotes(noteRows);
      setAppNotesPath(appFolder);
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Failed to load notes");
      setNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  useEffect(() => {
    void refreshNotes();
  }, []);

  const openEditorForDraft = (draftTitle: string, draftContent: string, sourceFiles: string[] = []) => {
    setTitle(draftTitle);
    setContent(draftContent);
    setActivePath(null);
    setSummarySourceFiles(sourceFiles);
    setEditorNotice(null);
    setEditorError(null);
    setView("editor");
  };

  const handleAddNote = () => {
    const nextTitle = createDefaultTitle("Note");
    openEditorForDraft(nextTitle, createTemplate(nextTitle));
  };

  const handleSummarizeFromFiles = async () => {
    setIsSummarizing(true);
    setEditorError(null);
    setEditorNotice(null);

    try {
      const filePaths = await tauriClient.pickFilesForOrganize();
      if (!filePaths.length) {
        setEditorNotice("No files selected for summary.");
        return;
      }

      const loadingTitle = filePaths.length > 1
        ? `Summary - ${filePaths.length} files`
        : createDefaultTitle("Summary");
      const loadingContent = `# ${loadingTitle}\n\nSummarizing selected files...`;
      openEditorForDraft(loadingTitle, loadingContent, filePaths);
      setEditorNotice("Summarizing files. Please wait...");

      const summarizeResult = await notesApiService.summarizeFromFiles(filePaths);
      const nextTitle = summarizeResult.suggestedTitle || createDefaultTitle("Summary");
      const nextContent = `# ${nextTitle}\n\n${summarizeResult.summary}\n`;
      setTitle(nextTitle);
      setContent(nextContent);
      setEditorNotice("Summary generated.");
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to summarize selected files");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleOpenNote = async (note: NoteFileItem) => {
    setEditorError(null);
    setEditorNotice(null);

    try {
      const markdown = await notesFileService.readNote(note.path);
      setTitle(stripMdSuffix(note.fileName));
      setContent(markdown);
      setActivePath(note.path);
      setSummarySourceFiles([]);
      setView("editor");
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to open note file");
    }
  };

  const saveToFolder = async (targetFolder: string) => {
    if (!targetFolder.trim()) {
      setEditorError("Target folder is required.");
      return;
    }

    setIsSaving(true);
    setEditorError(null);

    try {
      const savedPath = await notesFileService.saveToFolder(targetFolder, title, content);
      setActivePath(savedPath);
      setEditorNotice(`Saved note to ${savedPath}`);
      await refreshNotes();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to save note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToAppFolder = async () => {
    const appFolder = await notesFileService.getAppNotesFolderPath();
    await saveToFolder(appFolder);
  };

  const handleSaveToPickedFolder = async () => {
    const pickedFolder = await tauriClient.pickFolderForOrganize();
    if (!pickedFolder) {
      setEditorNotice("Save to folder cancelled.");
      return;
    }

    await saveToFolder(pickedFolder);
  };

  const handleSaveToCategory = async () => {
    const category = categoryOptions.find((item) => item.id === selectedCategoryId);
    if (!category?.folderPath) {
      setEditorError("Select a category with a valid folder path.");
      return;
    }

    await saveToFolder(category.folderPath);
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documents</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Notes</h2>
        {appNotesPath && (
          <p className="mt-1 truncate text-xs text-muted-foreground">App notes folder: {appNotesPath}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleAddNote} size="sm" className="gap-1.5">
          <FilePlus2 className="h-4 w-4" />
          Add Note
        </Button>
        <Button onClick={() => void handleSummarizeFromFiles()} size="sm" variant="secondary" className="gap-1.5">
          {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Summarize Notes
        </Button>
      </div>

      {editorError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {editorError}
        </div>
      )}

      {editorNotice && (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {editorNotice}
        </div>
      )}

      {view === "list" ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/20 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Existing Notes
          </div>

          <div className="space-y-2 p-3">
            {isLoadingNotes ? (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
                Loading notes...
              </div>
            ) : notesError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-5 text-center text-sm text-destructive">
                {notesError}
              </div>
            ) : notes.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
                No notes found yet. Click Add Note or Summarize Notes.
              </div>
            ) : (
              notes.map((note) => (
                <button
                  key={note.path}
                  type="button"
                  onClick={() => void handleOpenNote(note)}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <p className="truncate text-sm font-semibold text-foreground">{note.fileName}</p>
                  <div className="mt-1 grid gap-1 text-[11px] text-muted-foreground">
                    <p>Size: {formatBytes(note.sizeBytes)}</p>
                    <p>Last edited: {formatDate(note.lastModifiedMs)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setView("list")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="min-w-[220px] flex-1">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Note title"
                className="h-9 rounded-full border-border bg-background"
              />
            </div>

            <Button size="sm" onClick={() => void handleSaveToAppFolder()} disabled={isSaving || isSummarizing}>
              {isSaving ? "Saving..." : "Save"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSaveToPickedFolder()}
              disabled={isSaving || isSummarizing}
            >
              Save to Folder
            </Button>

            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className={cn(
                "h-9 min-w-[180px] rounded-full border border-border bg-background px-3 text-sm text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary",
              )}
            >
              <option value="">Select category</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleSaveToCategory()}
              disabled={isSaving || isSummarizing || !selectedCategoryId}
            >
              Save to Category
            </Button>
          </div>

          {activePath && (
            <div className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">Editing: {activePath}</div>
          )}

          {summarySourceFiles.length > 0 && (
            <div className="border-b border-border bg-primary/5 px-4 py-2 text-[11px] text-primary">
              <div className="mb-1 flex items-center gap-1.5 font-black uppercase tracking-wider">
                <Files className="h-3.5 w-3.5" />
                Summary source files
              </div>
              <p className="truncate">{summarySourceFiles.join(" | ")}</p>
            </div>
          )}

          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-border lg:border-b-0 lg:border-r">
              <div className="border-b border-border px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Write (.md)
              </div>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className={cn(
                  "min-h-[460px] w-full resize-none bg-card px-4 py-3 text-sm text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary/40",
                )}
                placeholder="Write markdown content..."
              />
            </div>

            <div>
              <div className="border-b border-border px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Preview
              </div>
              <div data-color-mode="dark" className="min-h-[460px] px-4 py-3">
                <MDEditor.Markdown
                  source={content}
                  style={{ backgroundColor: "transparent", color: "inherit" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
