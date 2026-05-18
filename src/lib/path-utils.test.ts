import { describe, it, expect } from "bun:test";
import {
  normalizePath,
  splitDestinationPath,
  getPathName,
  getPathTail,
  getFolderTail,
  joinPath,
  joinFolderPath,
  normalizeOsPath,
} from "./path-utils";

describe("normalizePath", () => {
  it("trims, lowercases, swaps backslashes, strips trailing slashes", () => {
    expect(normalizePath("  C:\\Users\\Test\\  ")).toBe("c:/users/test");
  });
  it("is idempotent on already-normalized input", () => {
    expect(normalizePath("c:/users/test")).toBe("c:/users/test");
  });
  it("returns an empty string for whitespace-only input", () => {
    expect(normalizePath("   ")).toBe("");
  });
  it("collapses multiple trailing slashes", () => {
    expect(normalizePath("c:/users/test///")).toBe("c:/users/test");
  });
});

describe("splitDestinationPath", () => {
  it("splits on the last separator (mixed slashes)", () => {
    expect(splitDestinationPath("dir/sub\\file.txt")).toEqual({
      folderPath: "dir/sub",
      fileName: "file.txt",
    });
  });
  it("returns empty folderPath when there is no separator", () => {
    expect(splitDestinationPath("file.txt")).toEqual({
      folderPath: "",
      fileName: "file.txt",
    });
  });
  it("handles forward-slash only paths", () => {
    expect(splitDestinationPath("a/b/c.md")).toEqual({
      folderPath: "a/b",
      fileName: "c.md",
    });
  });
});

describe("getPathName", () => {
  it("returns the tail segment", () => {
    expect(getPathName("C:\\Users\\foo.txt")).toBe("foo.txt");
  });
  it("returns the original path when no tail is found", () => {
    expect(getPathName("")).toBe("");
  });
});

describe("getPathTail", () => {
  it("returns the last non-empty segment, ignoring trailing slashes", () => {
    expect(getPathTail("c:/a/b/c/")).toBe("c");
  });
  it("falls back to the original value when there are no segments", () => {
    expect(getPathTail("")).toBe("");
  });
});

describe("getFolderTail", () => {
  it("returns all but the last segment when multiple segments exist", () => {
    expect(getFolderTail("c:/a/b/c")).toBe("c:/a/b");
  });
  it("returns the normalized path when there is only one segment", () => {
    expect(getFolderTail("foo")).toBe("foo");
  });
});

describe("joinPath", () => {
  it("joins folder + fileName with a forward slash", () => {
    expect(joinPath("c:/Users", "file.txt")).toBe("c:/Users/file.txt");
  });
  it("normalizes backslashes and trailing slash in folder", () => {
    expect(joinPath("c:\\Users\\", "file.txt")).toBe("c:/Users/file.txt");
  });
});

describe("joinFolderPath", () => {
  it("uses backslash separator for Windows drive paths", () => {
    expect(joinFolderPath("C:\\Users", "Docs")).toBe("C:\\Users\\Docs");
  });
  it("uses forward slash separator for POSIX paths", () => {
    expect(joinFolderPath("/home/user", "Docs")).toBe("/home/user/Docs");
  });
  it("returns just the name when base is empty", () => {
    expect(joinFolderPath("", "Docs")).toBe("Docs");
  });
  it("strips trailing separators from base before joining", () => {
    expect(joinFolderPath("C:\\Users\\", "Docs")).toBe("C:\\Users\\Docs");
  });
});

describe("normalizeOsPath", () => {
  it("converts forward to backslashes for Windows drive paths", () => {
    expect(normalizeOsPath("C:/Users/foo")).toBe("C:\\Users\\foo");
  });
  it("converts backslashes to forward slashes for POSIX paths", () => {
    expect(normalizeOsPath("/home/user\\foo")).toBe("/home/user/foo");
  });
});
