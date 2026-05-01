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

interface UndoRedoState {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => UndoEntry | undefined;
  pushRedo: (entry: UndoEntry) => void;
  popRedo: () => UndoEntry | undefined;
  removeFromUndo: (fromPath: string, toPath: string) => void;
  removeFromRedo: (fromPath: string, toPath: string) => void;
}

export const useUndoRedoStore = create<UndoRedoState>()(
  persist(
    (set, get) => ({
      undoStack: [],
      redoStack: [],
      pushUndo: (entry) =>
        set((s) => ({
          undoStack: [entry, ...s.undoStack].slice(0, MAX_STACK),
        })),
      popUndo: () => {
        const top = get().undoStack[0];
        if (!top) return undefined;
        set((s) => ({ undoStack: s.undoStack.slice(1) }));
        return top;
      },
      pushRedo: (entry) =>
        set((s) => ({
          redoStack: [entry, ...s.redoStack].slice(0, MAX_STACK),
        })),
      popRedo: () => {
        const top = get().redoStack[0];
        if (!top) return undefined;
        set((s) => ({ redoStack: s.redoStack.slice(1) }));
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
    }),
    { name: "klin-undo-redo" },
  ),
);
