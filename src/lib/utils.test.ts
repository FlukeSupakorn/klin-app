import { describe, it, expect } from "bun:test";
import { cn, formatBytes } from "./utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
  it("dedupes conflicting tailwind classes via tailwind-merge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("formatBytes", () => {
  it("returns '0 B' for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("returns KB for values >= 1024 and < 1MB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("returns MB for values in the megabyte range", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
  it("returns em-dash for negative values", () => {
    expect(formatBytes(-1)).toBe("—");
  });
  it("returns em-dash for non-finite values", () => {
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});
