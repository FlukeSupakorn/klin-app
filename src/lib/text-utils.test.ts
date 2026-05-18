import { describe, it, expect } from "bun:test";
import { normalizeCategoryLabel, normalizeCategoryName } from "./text-utils";

describe("normalizeCategoryLabel", () => {
  it("lowercases and collapses non-alphanumeric runs to single spaces", () => {
    expect(normalizeCategoryLabel("Finance @#$!")).toBe("finance");
  });
  it("preserves single internal spaces between alphanumerics", () => {
    expect(normalizeCategoryLabel("Work Stuff")).toBe("work stuff");
  });
  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeCategoryLabel("!!!")).toBe("");
  });
});

describe("normalizeCategoryName", () => {
  it("trims whitespace and lowercases", () => {
    expect(normalizeCategoryName("  WORK  ")).toBe("work");
  });
  it("does not strip internal punctuation", () => {
    expect(normalizeCategoryName(" Foo/Bar ")).toBe("foo/bar");
  });
});
