import { useCallback, useEffect, useMemo, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import { AlertTriangle, CheckCheck, ChevronLeft, Files, FileText, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { notesApiService } from "@/services/notes-api-service";
import { notesFileService, type NoteFileItem } from "@/services/notes-file-service";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";

type NotesView = "list" | "editor";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Unknown";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

function extractPreview(markdown: string): string {
  const lines = markdown.split("\n");
  const body = lines.filter((l) => !l.trim().startsWith("#")).join(" ").trim();
  return body.slice(0, 200);
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
  const [notesSearch, setNotesSearch] = useState("");
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notePreviews, setNotePreviews] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(createDefaultTitle());
  const [content, setContent] = useState(createTemplate("Quick Note"));
  const [activePath, setActivePath] = useState<string | null>(null);
  const [appNotesPath, setAppNotesPath] = useState<string>("");
  const [summarySourceFiles, setSummarySourceFiles] = useState<string[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isStreamingContent, setIsStreamingContent] = useState(false);
  const [summarizeElapsedSec, setSummarizeElapsedSec] = useState(0);
  const [summarizeStartedAt, setSummarizeStartedAt] = useState<number | null>(null);
  const [activeStreamController, setActiveStreamController] = useState<AbortController | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [showNoticeDetails, setShowNoticeDetails] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NoteFileItem | null>(null);

  const filteredNotes = useMemo(() => {
    const q = notesSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => stripMdSuffix(n.fileName).toLowerCase().includes(q));
  }, [notes, notesSearch]);

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.enabled && category.folderPath.trim().length > 0),
    [categories],
  );
  const getLockMatch = usePrivacyStore((state) => state.getLockMatch);
  const isLockWarningNotice = Boolean(editorNotice?.includes("skipped — locked"));
  const parsedEditorNotice = editorNotice ? splitLockNotice(editorNotice) : null;

  useEffect(() => {
    setShowNoticeDetails(false);
  }, [editorNotice]);

  const loadPreviews = useCallback(async (noteRows: NoteFileItem[]) => {
    const results: Record<string, string> = {};
    await Promise.all(
      noteRows.map(async (note) => {
        try {
          const md = await notesFileService.readNote(note.path);
          results[note.path] = extractPreview(md);
        } catch {
          results[note.path] = "";
        }
      }),
    );
    setNotePreviews(results);
  }, []);

  const refreshNotes = async () => {
    setIsLoadingNotes(true);
    setNotesError(null);
    try {
      const [noteRows, appFolder, cachedRows] = await Promise.all([
        notesFileService.listAppNotes(),
        notesFileService.getAppNotesFolderPath(),
        notesFileService.listCachedNotes(),
      ]);
      const appPaths = new Set(noteRows.map((n) => n.path));
      const merged = [...noteRows, ...cachedRows.filter((n) => !appPaths.has(n.path))];
      merged.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
      setNotes(merged);
      setAppNotesPath(appFolder);
      void loadPreviews(merged);
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Failed to load notes");
      setNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  useEffect(() => { void refreshNotes(); }, []);

  useEffect(() => {
    if (!isSummarizing || !summarizeStartedAt) return;
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

  const handleDeleteNote = (note: NoteFileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(note);
  };

  const confirmDeleteNote = async () => {
    if (!deleteTarget) return;
    try {
      await tauriClient.deleteFile(deleteTarget.path);
      await refreshNotes();
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Failed to delete note");
    } finally {
      setDeleteTarget(null);
    }
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
          blocked.push({ source: match.source, fileName: getPathTail(path), lockedByName: getPathTail(match.lockedPath) });
          continue;
        }
        allowed.push(path);
      }

      const blockedNotice = blocked.length > 0
        ? (() => {
          const previewNames = blocked.slice(0, 2).map((item) => item.fileName);
          const remaining = blocked.length - previewNames.length;
          const head = previewNames.join(", ");
          const summary = `${blocked.length} file(s) skipped — locked: ${head}${remaining > 0 ? ` +${remaining} more` : ""}`;
          const detailLines = blocked.map((item) => (
            item.source === "folder"
              ? `${item.fileName} (locked by folder ${item.lockedByName})`
              : `${item.fileName} (locked)`
          ));
          return `${summary}${LOCK_NOTICE_DETAILS_SEPARATOR}${detailLines.join("\n")}`;
        })()
        : null;

      if (blockedNotice) setEditorNotice(blockedNotice);
      if (!allowed.length) return;

      const loadingTitle = allowed.length > 1 ? `Summary - ${allowed.length} files` : createDefaultTitle("Summary");
      const loadingContent = `# ${loadingTitle}\n\n_Summarizing selected files._`;
      openEditorForDraft(loadingTitle, loadingContent, allowed);
      setEditorNotice(blockedNotice ? `${blockedNotice} | Summarizing remaining files...` : "Summarizing files. Please wait...");

      let liveTitle = loadingTitle;
      let streamed = "";
      let hasFirstChunk = false;
      const dotPhases = [".", "..", "..."];
      let dotIndex = 0;
      const renderWaiting = () => {
        if (hasFirstChunk) return;
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
            if (waitingTimer) { clearInterval(waitingTimer); waitingTimer = null; }
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
      if (waitingTimer) clearInterval(waitingTimer);
      setIsSummarizing(false);
      setIsStreamingContent(false);
      setSummarizeStartedAt(null);
      setActiveStreamController(null);
    }
  };

  const handleStopSummarize = () => { activeStreamController?.abort(); };

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
    if (!targetFolder.trim()) { setEditorError("Target folder is required."); return; }
    setIsSaving(true);
    setEditorError(null);
    try {
      const savedPath = await notesFileService.saveToFolder(targetFolder, title, content);
      setActivePath(savedPath);
      // Track external saves so they appear on the notes list
      const normalizedSaved = savedPath.replace(/\\/g, "/");
      const normalizedApp = appNotesPath.replace(/\\/g, "/");
      if (appNotesPath && !normalizedSaved.startsWith(normalizedApp)) {
        await notesFileService.appendToSavedPathsCache(savedPath);
      }
      try {
        await notesApiService.logNoteHistory({
          fileName: getPathTail(savedPath),
          destinationPath: savedPath,
          sourceFiles: summarySourceFiles,
          categoryName: options?.categoryName,
        });
      } catch { /* history logging failure is non-fatal */ }
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
      setEditorNotice(`Saved to ${savedPath}`);
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
    if (!pickedFolder) { setEditorNotice("Save to folder cancelled."); return; }
    await saveToFolder(pickedFolder);
  };

  const handleSaveToCategory = async () => {
    const category = categoryOptions.find((item) => item.id === selectedCategoryId);
    if (!category?.folderPath) { setEditorError("Select a category with a valid folder path."); return; }
    await saveToFolder(category.folderPath, { categoryName: category.name });
  };

  if (view === "editor") {
    return (
      <div
        className="flex h-full flex-col gap-0 overflow-hidden rounded-[18px] border border-border bg-card"
        style={{ boxShadow: "var(--shadow-xs)" }}
      >
        {/* Editor toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-card px-4 py-3">
          {/* Back button */}
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>

          {/* Title input */}
          <div
            className="flex h-9 min-w-[220px] flex-1 items-center rounded-[12px] border border-border bg-card px-3"
            style={{ boxShadow: "var(--shadow-xs)" }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full bg-transparent text-[13px] font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={() => void handleSaveToAppFolder()}
            disabled={isSaving || isSummarizing}
            className="flex shrink-0 items-center gap-1.5 rounded-[10px] px-4 py-1.5 text-[12.5px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--primary)", boxShadow: "0 4px 12px var(--primary-glow)" }}
          >
            {savedFeedback ? (
              <>
                <CheckCheck className="h-3.5 w-3.5" />
                Saved ✓
              </>
            ) : isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>

          {/* Save to Folder */}
          <button
            type="button"
            onClick={() => void handleSaveToPickedFolder()}
            disabled={isSaving || isSummarizing}
            className="shrink-0 rounded-[10px] border border-border px-3.5 py-1.5 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Save to Folder
          </button>

          {/* Category select */}
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="h-9 min-w-[150px] shrink-0 rounded-[10px] border border-border bg-card px-3 text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select category</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          {/* Save to Category */}
          <button
            type="button"
            onClick={() => void handleSaveToCategory()}
            disabled={isSaving || isSummarizing || !selectedCategoryId}
            className="shrink-0 rounded-[10px] border border-border px-3.5 py-1.5 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Save to Category
          </button>
        </div>

        {/* Status strips */}
        {activePath && (
          <div className="shrink-0 border-b border-border px-4 py-1.5 text-[11px] text-muted-foreground">
            Editing: {activePath}
          </div>
        )}

        {summarySourceFiles.length > 0 && (
          <div
            className="shrink-0 border-b border-border px-4 py-2 text-[11px] text-primary"
            style={{ background: "var(--primary-tint)" }}
          >
            <div className="mb-0.5 flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <Files className="h-3 w-3" />
              Summary source files
            </div>
            <p className="truncate">{summarySourceFiles.join(" | ")}</p>
          </div>
        )}

        {isSummarizing && (
          <div
            className="shrink-0 border-b border-border px-4 py-2 text-[11px] text-primary"
            style={{ background: "var(--primary-tint)" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>
                {isStreamingContent ? "Writing summary" : "Preparing summary"}
                <span className="ml-1 animate-pulse">|</span>
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "var(--primary-soft)" }}
              >
                {summarizeElapsedSec}s
              </span>
              <button
                type="button"
                onClick={handleStopSummarize}
                className="rounded-[7px] border border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {editorError && (
          <div
            className="shrink-0 border-b border-destructive/20 px-4 py-2 text-[12px] text-destructive"
            style={{ background: "var(--destructive-tint)" }}
          >
            {editorError}
          </div>
        )}

        {editorNotice && (
          <div
            className={cn(
              "shrink-0 border-b px-4 py-2 text-[12px]",
              isLockWarningNotice
                ? "border-amber-500/30 text-amber-700"
                : "border-primary/20 text-primary",
            )}
            style={{ background: isLockWarningNotice ? "var(--warning-tint)" : "var(--primary-tint)" }}
          >
            <div className="flex items-start gap-2">
              {isLockWarningNotice && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <div className="space-y-1">
                <p>
                  {parsedEditorNotice?.summary ?? editorNotice}
                  {isLockWarningNotice && (parsedEditorNotice?.details.length ?? 0) > 0 && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => setShowNoticeDetails((prev) => !prev)}
                        className="text-[11px] font-bold underline underline-offset-2"
                      >
                        {showNoticeDetails ? "Hide details" : "Read more"}
                      </button>
                    </>
                  )}
                </p>
                {isLockWarningNotice && showNoticeDetails && (parsedEditorNotice?.details.length ?? 0) > 0 && (
                  <ul className="list-disc space-y-0.5 pl-4 text-[11px]">
                    {parsedEditorNotice?.details.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Split editor */}
        <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
          {/* Write panel */}
          <div className="flex flex-col overflow-hidden border-r border-border">
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: "var(--orange)" }}
              />
              <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
                Write (.md)
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 resize-none bg-card px-4 py-3 font-mono text-[13px] text-foreground focus:outline-none"
              placeholder="Write markdown content..."
            />
          </div>

          {/* Preview panel */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: "var(--success)" }}
              />
              <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
                Preview
              </span>
            </div>
            <div data-color-mode="dark" className="flex-1 overflow-y-auto px-4 py-3">
              <MDEditor.Markdown source={content} style={{ backgroundColor: "transparent", color: "inherit" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setDeleteTarget(null)} />
          <div
            className="relative w-[340px] overflow-hidden rounded-[20px] border border-border bg-card p-6"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[12px]"
              style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <Trash2 className="h-5 w-5" style={{ color: "var(--destructive)" }} />
            </div>
            <div className="text-[15px] font-extrabold text-foreground">Delete note?</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">
              &ldquo;{stripMdSuffix(deleteTarget.fileName)}&rdquo; will be permanently removed.
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-[12px] border border-border bg-muted py-2.5 text-[13px] font-bold text-foreground transition-colors hover:bg-muted/70"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDeleteNote()}
                className="flex-1 rounded-[12px] py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--destructive)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex-1">
          <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Documents
          </div>
          <h1
            className="mt-0.5 text-[21px] font-extrabold tracking-tight text-foreground"
            style={{ letterSpacing: "-0.4px" }}
          >
            Notes
          </h1>
          {appNotesPath && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{appNotesPath}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-[12px] border border-border bg-card px-3 py-2"
            style={{ width: 180, boxShadow: "var(--shadow-xs)" }}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={notesSearch}
              onChange={(e) => setNotesSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleAddNote}
            className="flex items-center gap-1.5 rounded-[12px] px-3.5 py-2 text-[12.5px] font-bold text-white transition-all hover:opacity-90"
            style={{ background: "var(--primary)", boxShadow: "0 4px 14px var(--primary-glow)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Note
          </button>
          <button
            type="button"
            onClick={() => void handleSummarizeFromFiles()}
            disabled={isSummarizing}
            className="flex items-center gap-1.5 rounded-[12px] border border-border bg-card px-3.5 py-2 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
            style={{ boxShadow: "var(--shadow-xs)" }}
          >
            {isSummarizing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            AI Summarize
          </button>
        </div>
      </div>

      {/* Global notices */}
      {editorError && (
        <div
          className="shrink-0 rounded-[12px] border border-destructive/20 px-4 py-3 text-[12px] text-destructive"
          style={{ background: "var(--destructive-tint)" }}
        >
          {editorError}
        </div>
      )}

      {/* Notes masonry grid */}
      <div className="flex-1 overflow-y-auto pb-4">
        {isLoadingNotes ? (
          <div className="rounded-[14px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading notes...
          </div>
        ) : notesError ? (
          <div className="rounded-[14px] border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
            {notesError}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[18px] border border-border bg-card">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[16px]"
              style={{ background: "var(--primary)", boxShadow: "0 6px 20px var(--primary-glow)" }}
            >
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="text-center">
              <div className="text-[14px] font-extrabold text-foreground">
                {notesSearch ? "No matching notes" : "No notes yet"}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {notesSearch ? "Try a different search term" : "Click Add Note or use AI Summarize"}
              </div>
            </div>
            {!notesSearch && (
              <button
                type="button"
                onClick={handleAddNote}
                className="flex items-center gap-1.5 rounded-[12px] px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:opacity-90"
                style={{ background: "var(--primary)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Create First Note
              </button>
            )}
          </div>
        ) : (
          <div style={{ columns: "3 220px", gap: "12px" }}>
            {filteredNotes.map((note) => (
              <div key={note.path} style={{ breakInside: "avoid", marginBottom: "12px" }}>
                <div
                  className="group overflow-hidden rounded-[16px] border border-border bg-card transition-all hover:shadow-md"
                  style={{ boxShadow: "0 2px 10px var(--primary-tint)" }}
                >
                  {/* Card header strip */}
                  <button
                    type="button"
                    onClick={() => void handleOpenNote(note)}
                    className="w-full text-left"
                  >
                    <div
                      className="flex h-[52px] items-center justify-between px-3.5"
                      style={{ background: "var(--primary)" }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                          style={{ background: "rgba(255,255,255,0.20)" }}
                        >
                          <FileText className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-[11px] font-bold text-white opacity-80">Note</span>
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => void handleDeleteNote(note, e)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleDeleteNote(note, e as unknown as React.MouseEvent);
                          }
                        }}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ background: "rgba(255,255,255,0.20)" }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                  </button>

                  {/* Card body */}
                  <button
                    type="button"
                    onClick={() => void handleOpenNote(note)}
                    className="w-full px-3.5 pb-3 pt-2.5 text-left"
                  >
                    <div className="truncate text-[13.5px] font-extrabold text-foreground">
                      {stripMdSuffix(note.fileName)}
                    </div>
                    {notePreviews[note.path] && (
                      <p
                        className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {notePreviews[note.path]}
                      </p>
                    )}
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[10.5px] text-muted-foreground">
                        {formatDate(note.lastModifiedMs)}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground">
                        {formatBytes(note.sizeBytes)}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
