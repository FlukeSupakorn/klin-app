/**
 * Error utility functions
 */

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error && typeof error === "object" && "name" in error) {
    return (error as { name?: string }).name === "AbortError";
  }

  if (error instanceof Error) {
    return /abort/i.test(error.message);
  }

  return false;
}
