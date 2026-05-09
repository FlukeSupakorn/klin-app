import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizePath } from "@/lib/path-utils";

const MAX_STACK = 10;

export type UndoEntry = {
  workerFileId: string | null;
  fromPath: string;
  toPath: string;
  fileName: string;
  category: { id: string; name: string; score: number } | null;
};

function pathKey(fromPath: string, toPath: string): string {
  return `${normalizePath(fromPath)}|${normalizePath(toPath)}`;
}

interface UndoRedoState {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  /**
   * IDs of organize-history entries that were undone in the current app session.
   * Keyed by `${normalizePath(originalFromPath)}|${normalizePath(originalToPath)}`
   * (the same orientation history-page.tsx uses for its redo lookup).
   * NOT persisted: starts empty on every cold start so a stale redoStack from
   * a prior session can never light up a redo button.
   */
  sessionUndoneIds: Set<string>;
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => UndoEntry | undefined;
  pushRedo: (entry: UndoEntry) => void;
  popRedo: () => UndoEntry | undefined;
  removeFromUndo: (fromPath: string, toPath: string) => void;
  removeFromRedo: (fromPath: string, toPath: string) => void;
  markUndone: (originalFromPath: string, originalToPath: string) => void;
  clearUndone: (originalFromPath: string, originalToPath: string) => void;
  /**
   * Returns true if an organize-history entry with the given original
   * (fromPath → toPath) was undone in this session.
   */
  isUndoneInSession: (originalFromPath: string, originalToPath: string) => boolean;
}

export const useUndoRedoStore = create<UndoRedoState>()(
  persist(
    (set, get) => ({
      undoStack: [],
      redoStack: [],
      sessionUndoneIds: new Set<string>(),
      pushUndo: (entry) =>
        set((s) => ({
          undoStack: [entry, ...s.undoStack].slice(0, MAX_STACK),
        })),
      popUndo: () => {
        const top = get().undoStack[0];
        if (!top) return undefined;
        // After undo: file is back at its original location. The redo direction
        // is original-from → original-to, which is the inverse of the undo entry.
        const sessionKey = pathKey(top.toPath, top.fromPath);
        set((s) => {
          const nextSet = new Set(s.sessionUndoneIds);
          nextSet.add(sessionKey);
          return { undoStack: s.undoStack.slice(1), sessionUndoneIds: nextSet };
        });
        return top;
      },
      pushRedo: (entry) =>
        set((s) => ({
          redoStack: [entry, ...s.redoStack].slice(0, MAX_STACK),
        })),
      popRedo: () => {
        const top = get().redoStack[0];
        if (!top) return undefined;
        const sessionKey = pathKey(top.fromPath, top.toPath);
        set((s) => {
          const nextSet = new Set(s.sessionUndoneIds);
          nextSet.delete(sessionKey);
          return { redoStack: s.redoStack.slice(1), sessionUndoneIds: nextSet };
        });
        return top;
      },
      removeFromUndo: (fromPath, toPath) =>
        set((s) => ({
          undoStack: s.undoStack.filter(
            (e) => !(normalizePath(e.fromPath) === normalizePath(fromPath) && normalizePath(e.toPath) === normalizePath(toPath)),
          ),
        })),
      removeFromRedo: (fromPath, toPath) =>
        set((s) => ({
          redoStack: s.redoStack.filter(
            (e) => !(normalizePath(e.fromPath) === normalizePath(fromPath) && normalizePath(e.toPath) === normalizePath(toPath)),
          ),
        })),
      markUndone: (originalFromPath, originalToPath) =>
        set((s) => {
          const nextSet = new Set(s.sessionUndoneIds);
          nextSet.add(pathKey(originalFromPath, originalToPath));
          return { sessionUndoneIds: nextSet };
        }),
      clearUndone: (originalFromPath, originalToPath) =>
        set((s) => {
          const nextSet = new Set(s.sessionUndoneIds);
          nextSet.delete(pathKey(originalFromPath, originalToPath));
          return { sessionUndoneIds: nextSet };
        }),
      isUndoneInSession: (originalFromPath, originalToPath) =>
        get().sessionUndoneIds.has(pathKey(originalFromPath, originalToPath)),
    }),
    {
      name: "klin-undo-redo",
      version: 1,
      // Only persist undoStack. redoStack lives in memory only — on cold start
      // it always begins empty, so the redo button can't be lit by stale cache.
      // sessionUndoneIds is also memory-only (and not serializable as a Set).
      partialize: (state) => ({ undoStack: state.undoStack }),
      migrate: (persistedState, _version) => {
        const legacy = persistedState as { undoStack?: UndoEntry[] } | undefined;
        return { undoStack: legacy?.undoStack ?? [] };
      },
    },
  ),
);
