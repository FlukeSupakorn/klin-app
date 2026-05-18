import { describe, it, expect } from "bun:test";
import { isAbortError } from "./error-utils";

describe("isAbortError", () => {
  it("returns true for a DOMException with name AbortError", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(isAbortError(err)).toBe(true);
  });
  it("returns true for a plain object with name === 'AbortError'", () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
  });
  it("returns true for an Error whose name is set to 'AbortError'", () => {
    const e = new Error("aborted");
    e.name = "AbortError";
    expect(isAbortError(e)).toBe(true);
  });
  it("returns false for a regular Error with the default name", () => {
    expect(isAbortError(new Error("network down"))).toBe(false);
  });
  it("returns false for null / undefined / primitives", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError("abort")).toBe(false);
  });
});
