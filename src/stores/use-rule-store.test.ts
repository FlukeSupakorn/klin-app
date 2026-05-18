import { describe, it, expect, beforeEach } from "bun:test";
import { useRuleStore } from "./use-rule-store";

beforeEach(() => {
  useRuleStore.setState({ categoryToFolderMap: [] }, false);
});

describe("useRuleStore.validateMapping", () => {
  it("rejects empty categoryName", () => {
    expect(
      useRuleStore
        .getState()
        .validateMapping({ categoryName: "", folderPath: "/x", isActive: true }),
    ).toBe(false);
  });
  it("rejects whitespace-only folderPath", () => {
    expect(
      useRuleStore
        .getState()
        .validateMapping({ categoryName: "Work", folderPath: "   ", isActive: true }),
    ).toBe(false);
  });
  it("accepts a non-empty mapping", () => {
    expect(
      useRuleStore
        .getState()
        .validateMapping({ categoryName: "Work", folderPath: "C:/Work", isActive: true }),
    ).toBe(true);
  });
});

describe("useRuleStore.setMapping", () => {
  it("appends a new mapping", () => {
    useRuleStore.getState().setMapping("Work", "C:/Work");
    const map = useRuleStore.getState().categoryToFolderMap;
    expect(map).toHaveLength(1);
    expect(map[0]).toEqual({ categoryName: "Work", folderPath: "C:/Work", isActive: true });
  });
  it("upserts: replaces an existing mapping with the same categoryName", () => {
    const { setMapping } = useRuleStore.getState();
    setMapping("Work", "C:/Old");
    setMapping("Work", "C:/New", false);
    const map = useRuleStore.getState().categoryToFolderMap;
    expect(map).toHaveLength(1);
    expect(map[0]).toEqual({ categoryName: "Work", folderPath: "C:/New", isActive: false });
  });
  it("ignores invalid mappings (no entry added)", () => {
    useRuleStore.getState().setMapping("", "C:/Work");
    expect(useRuleStore.getState().categoryToFolderMap).toHaveLength(0);
  });
});

describe("useRuleStore.removeMapping", () => {
  it("removes the mapping with the matching categoryName", () => {
    const { setMapping, removeMapping } = useRuleStore.getState();
    setMapping("Work", "C:/Work");
    setMapping("Personal", "C:/Personal");
    removeMapping("Work");
    const map = useRuleStore.getState().categoryToFolderMap;
    expect(map).toHaveLength(1);
    expect(map[0].categoryName).toBe("Personal");
  });
  it("is a no-op when the name does not exist", () => {
    useRuleStore.getState().setMapping("Work", "C:/Work");
    useRuleStore.getState().removeMapping("Nope");
    expect(useRuleStore.getState().categoryToFolderMap).toHaveLength(1);
  });
});
