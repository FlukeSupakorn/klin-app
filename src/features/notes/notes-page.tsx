import { useEffect, useMemo, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { AlertTriangle, ArrowLeft, FilePlus2, Files, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { notesApiService } from "@/services/notes-api-service";
import { notesFileService, type NoteFileItem } from "@/services/notes-file-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";

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

function getPathTail(path: string): string {
  const value = path.split(/[\\/]/).pop();
  return value && value.trim().length > 0 ? value : "Quick-Note.md";
}

const LOCK_NOTICE_DETAILS_SEPARATOR = "\n__DETAILS__\n";

function splitLockNotice(message: string): { summary: string; details: string[] } {
  const [summaryPart, detailsPart] = message.split(LOCK_NOTICE_DETAILS_SEPARATOR);
  const summary = (summaryPart ?? "").trim();
  const details = (detailsPart ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { summary, details };
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
  const [isStreamingContent, setIsStreamingContent] = useState(false);
  const [summarizeElapsedSec, setSummarizeElapsedSec] = useState(0);
  const [summarizeStartedAt, setSummarizeStartedAt] = useState<number | null>(null);
  const [activeStreamController, setActiveStreamController] = useState<AbortController | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [showNoticeDetails, setShowNoticeDetails] = useState(false);

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.enabled && category.folderPath.trim().length > 0),
    [categories],
  );
  const getLockMatch = usePrivacyStore((state) => state.getLockMatch);
  const isLockWarningNotice = Boolean(editorNotice?.startsWith("Skipped "));
  const parsedEditorNotice = editorNotice ? splitLockNotice(editorNotice) : null;

  useEffect(() => {
    setShowNoticeDetails(false);
  }, [editorNotice]);

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

  useEffect(() => {
    if (!isSummarizing || !summarizeStartedAt) {
      return;
    }

    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - summarizeStartedAt) / 1000));
      setSummarizeElapsedSec(seconds);
    }, 500);

    return () => clearInterval(timer);
  }, [isSummarizing, summarizeStartedAt]);

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
    setIsStreamingContent(false);
    setSummarizeStartedAt(Date.now());
    setSummarizeElapsedSec(0);
    setEditorError(null);
    setEditorNotice(null);
    let waitingTimer: ReturnType<typeof setInterval> | null = null;
    const streamController = new AbortController();
    setActiveStreamController(streamController);

    try {
      const filePaths = await tauriClient.pickFilesForOrganize();
      if (!filePaths.length) {
        setEditorNotice("No files selected for summary.");
        return;
      }

      const blocked: Array<{ source: "file" | "folder"; fileName: string; lockedByName: string }> = [];
      const allowed: string[] = [];
      for (const path of filePaths) {
        const match = getLockMatch(path);
        if (match) {
          blocked.push({
            source: match.source,
            fileName: getPathTail(path),
            lockedByName: getPathTail(match.lockedPath),
          });
          continue;
        }

        allowed.push(path);
      }

      const blockedNotice = blocked.length > 0
        ? (() => {
          const previewNames = blocked.slice(0, 2).map((item) => item.fileName);
          const remaining = blocked.length - previewNames.length;
          const head = previewNames.join(", ");
          const summary = `Skipped ${blocked.length} locked file(s): ${head}${remaining > 0 ? ` +${remaining} more` : ""}`;
          const detailLines = blocked.map((item) => (
            item.source === "folder"
              ? `${item.fileName} - locked by folder ${item.lockedByName}`
              : `${item.fileName} - locked file`
          ));
          return `${summary}${LOCK_NOTICE_DETAILS_SEPARATOR}${detailLines.join("\n")}`;
        })()
        : null;

      if (blockedNotice) {
        setEditorNotice(blockedNotice);
      }

      if (!allowed.length) {
        return;
      }

      const loadingTitle = allowed.length > 1
        ? `Summary - ${allowed.length} files`
        : createDefaultTitle("Summary");
      const loadingContent = `# ${loadingTitle}\n\n_Summarizing selected files._`;
      openEditorForDraft(loadingTitle, loadingContent, allowed);
      setEditorNotice(blockedNotice
        ? `${blockedNotice} | Summarizing remaining files...`
        : "Summarizing files. Please wait...");

      let liveTitle = loadingTitle;
      let streamed = "";
      let hasFirstChunk = false;
      const dotPhases = [".", "..", "..."];
      let dotIndex = 0;
      const renderWaiting = () => {
        if (hasFirstChunk) {
          return;
        }

        const dots = dotPhases[dotIndex % dotPhases.length];
        dotIndex += 1;
        setContent(`# ${liveTitle}\n\n_Summarizing selected files${dots}_`);
      };

      renderWaiting();
      waitingTimer = setInterval(renderWaiting, 350);

      const summarizeResult = await notesApiService.summarizeFromFilesStream(allowed, {
        signal: streamController.signal,
        onMeta: (meta) => {
          if (meta.suggestedTitle?.trim()) {
            liveTitle = meta.suggestedTitle.trim();
            setTitle(liveTitle);
            renderWaiting();
          }
        },
        onChunk: (delta) => {
          if (!hasFirstChunk) {
            hasFirstChunk = true;
            setIsStreamingContent(true);
            if (waitingTimer) {
              clearInterval(waitingTimer);
              waitingTimer = null;
            }
            streamed = "";
          }
          streamed += delta;
          setContent(`# ${liveTitle}\n\n${streamed}`);
        },
      });

      const nextTitle = summarizeResult.suggestedTitle || liveTitle || createDefaultTitle("Summary");
      const nextContent = `# ${nextTitle}\n\n${summarizeResult.summary}\n`;
      setTitle(nextTitle);
      setContent(nextContent);
      setEditorNotice("Summary generated.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setEditorNotice("Summary canceled.");
      } else {
        setEditorError(error instanceof Error ? error.message : "Failed to summarize selected files");
      }
    } finally {
      if (waitingTimer) {
        clearInterval(waitingTimer);
      }
      setIsSummarizing(false);
      setIsStreamingContent(false);
      setSummarizeStartedAt(null);
      setActiveStreamController(null);
    }
  };

  const handleStopSummarize = () => {
    if (!activeStreamController) {
      return;
    }

    activeStreamController.abort();
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

  const saveToFolder = async (targetFolder: string, options?: { categoryName?: string }) => {
    if (!targetFolder.trim()) {
      setEditorError("Target folder is required.");
      return;
    }

    setIsSaving(true);
    setEditorError(null);

    try {
      const savedPath = await notesFileService.saveToFolder(targetFolder, title, content);
      setActivePath(savedPath);

      try {
        await notesApiService.logNoteHistory({
          fileName: getPathTail(savedPath),
          destinationPath: savedPath,
          sourceFiles: summarySourceFiles,
          categoryName: options?.categoryName,
        });
      } catch {
        // Keep note save successful even if history logging fails.
      }

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

    await saveToFolder(category.folderPath, { categoryName: category.name });
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
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            isLockWarningNotice
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
              : "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          <div className="flex items-start gap-2">
            {isLockWarningNotice && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            <div className="space-y-2">
              <p className="leading-5">
                {parsedEditorNotice?.summary ?? editorNotice}
                {isLockWarningNotice && (parsedEditorNotice?.details.length ?? 0) > 0 && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setShowNoticeDetails((prev) => !prev)}
                      className="text-xs font-semibold underline underline-offset-2"
                    >
                      {showNoticeDetails ? "Hide details" : "Read more"}
                    </button>
                  </>
                )}
              </p>
              {isLockWarningNotice && (parsedEditorNotice?.details.length ?? 0) > 0 && (
                <div className="space-y-2">
                  {showNoticeDetails && (
                    <ul className="list-disc space-y-1 pl-4 text-xs">
                      {parsedEditorNotice?.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
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

          {isSummarizing && (
            <div className="border-b border-border bg-primary/5 px-4 py-2 text-xs text-primary">
              <div className="flex flex-wrap items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {isStreamingContent ? "Writing summary" : "Preparing summary"}
                  <span className="ml-1 animate-pulse">|</span>
                </span>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {summarizeElapsedSec}s
                </span>
                <Button size="sm" variant="ghost" onClick={handleStopSummarize} className="h-7 px-2 text-xs">
                  Stop
                </Button>
              </div>
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
