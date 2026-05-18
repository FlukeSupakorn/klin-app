import { describe, it, expect } from "bun:test";
import { findCategoryColor } from "./category-utils";

const palette = [
  { name: "work", color: "#ff0000" },
  { name: "Personal", color: "#00ff00" },
];

describe("findCategoryColor", () => {
  it("matches case-insensitively", () => {
    expect(findCategoryColor("WORK", palette)).toBe("#ff0000");
    expect(findCategoryColor("personal", palette)).toBe("#00ff00");
  });
  it("returns null when no entry matches", () => {
    expect(findCategoryColor("missing", palette)).toBeNull();
  });
  it("returns null for whitespace-only input", () => {
    expect(findCategoryColor("   ", palette)).toBeNull();
  });
  it("returns null for an empty palette", () => {
    expect(findCategoryColor("work", [])).toBeNull();
  });
});
