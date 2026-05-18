import { describe, it, expect, beforeEach } from "bun:test";
import { useUndoRedoStore, type UndoEntry } from "./use-undo-redo-store";

function entry(over: Partial<UndoEntry> = {}): UndoEntry {
  return {
    workerFileId: null,
    fromPath: "C:\\src\\file.txt",
    toPath: "C:\\dst\\file.txt",
    fileName: "file.txt",
    category: null,
    ...over,
  };
}

beforeEach(() => {
  useUndoRedoStore.setState(
    { undoStack: [], redoStack: [], sessionUndoneIds: new Set<string>() },
    false,
  );
});

describe("useUndoRedoStore — push/pop are LIFO", () => {
  it("pushUndo prepends to the stack", () => {
    const { pushUndo } = useUndoRedoStore.getState();
    pushUndo(entry({ fileName: "a.txt" }));
    pushUndo(entry({ fileName: "b.txt" }));
    const stack = useUndoRedoStore.getState().undoStack;
    expect(stack).toHaveLength(2);
    expect(stack[0].fileName).toBe("b.txt");
    expect(stack[1].fileName).toBe("a.txt");
  });
  it("popUndo returns the most recent entry and removes it", () => {
    const { pushUndo, popUndo } = useUndoRedoStore.getState();
    pushUndo(entry({ fileName: "a.txt" }));
    pushUndo(entry({ fileName: "b.txt" }));
    expect(popUndo()?.fileName).toBe("b.txt");
    expect(useUndoRedoStore.getState().undoStack).toHaveLength(1);
  });
  it("popUndo on empty stack returns undefined", () => {
    expect(useUndoRedoStore.getState().popUndo()).toBeUndefined();
  });
  it("pushRedo + popRedo behave LIFO", () => {
    const { pushRedo, popRedo } = useUndoRedoStore.getState();
    pushRedo(entry({ fileName: "x.txt" }));
    pushRedo(entry({ fileName: "y.txt" }));
    expect(popRedo()?.fileName).toBe("y.txt");
    expect(useUndoRedoStore.getState().redoStack).toHaveLength(1);
  });
});

describe("useUndoRedoStore — sessionUndoneIds via markUndone / isUndoneInSession", () => {
  it("round-trips with exact paths", () => {
    const { markUndone, isUndoneInSession } = useUndoRedoStore.getState();
    markUndone("C:\\src\\a", "C:\\dst\\a");
    expect(isUndoneInSession("C:\\src\\a", "C:\\dst\\a")).toBe(true);
  });
  it("treats path-equivalent inputs (case + separators) as the same key", () => {
    const { markUndone, isUndoneInSession } = useUndoRedoStore.getState();
    markUndone("C:\\Src\\A", "C:\\Dst\\A");
    expect(isUndoneInSession("c:/src/a", "c:/dst/a")).toBe(true);
  });
  it("returns false for an unrelated pair", () => {
    expect(
      useUndoRedoStore.getState().isUndoneInSession("c:/x", "c:/y"),
    ).toBe(false);
  });
  it("clearUndone removes the entry", () => {
    const { markUndone, clearUndone, isUndoneInSession } = useUndoRedoStore.getState();
    markUndone("c:/a", "c:/b");
    clearUndone("c:/a", "c:/b");
    expect(isUndoneInSession("c:/a", "c:/b")).toBe(false);
  });
});

describe("useUndoRedoStore — popUndo marks the inverse direction as undone", () => {
  it("after popUndo, isUndoneInSession is true for (toPath, fromPath)", () => {
    const { pushUndo, popUndo, isUndoneInSession } = useUndoRedoStore.getState();
    pushUndo(entry({ fromPath: "C:\\src\\a", toPath: "C:\\dst\\a" }));
    popUndo();
    // popUndo keys by (top.toPath, top.fromPath) — i.e. the original organize direction.
    expect(isUndoneInSession("C:\\dst\\a", "C:\\src\\a")).toBe(true);
  });
});

describe("useUndoRedoStore — removeFromUndo / removeFromRedo", () => {
  it("removeFromUndo drops entries matching normalized paths", () => {
    const { pushUndo, removeFromUndo } = useUndoRedoStore.getState();
    pushUndo(entry({ fromPath: "C:\\X\\a", toPath: "C:\\Y\\a" }));
    pushUndo(entry({ fromPath: "C:\\X\\b", toPath: "C:\\Y\\b" }));
    removeFromUndo("c:/x/a", "c:/y/a");
    const stack = useUndoRedoStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].fromPath).toBe("C:\\X\\b");
  });
  it("removeFromRedo drops the matching entry only", () => {
    const { pushRedo, removeFromRedo } = useUndoRedoStore.getState();
    pushRedo(entry({ fromPath: "C:\\X\\a", toPath: "C:\\Y\\a" }));
    pushRedo(entry({ fromPath: "C:\\X\\b", toPath: "C:\\Y\\b" }));
    removeFromRedo("c:/x/b", "c:/y/b");
    expect(useUndoRedoStore.getState().redoStack).toHaveLength(1);
  });
});
