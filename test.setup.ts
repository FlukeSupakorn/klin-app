// Provide a minimal in-memory localStorage so zustand's `persist` middleware
// doesn't blow up under the Node test environment. We don't assert on
// persisted state — this is purely to keep store imports from throwing.
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// Bun's runtime exposes a `localStorage` that throws on access, which trips
// zustand's `persist` middleware. Override unconditionally with our in-memory
// shim.
Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage() as unknown as Storage,
  writable: true,
  configurable: true,
});

// zustand caches the storage adapter at module evaluation, which races with
// the override above. The warning is harmless (we don't assert on persistence),
// so filter it out of console.error to keep test output clean.
const isZustandPersistNoise = (args: unknown[]): boolean => {
  const first = args[0];
  return typeof first === "string" && first.includes("[zustand persist middleware]");
};

for (const method of ["error", "warn", "log"] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    if (isZustandPersistNoise(args)) return;
    original(...args);
  };
}
