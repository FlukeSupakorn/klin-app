import { create } from "zustand";
import { persist } from "zustand/middleware";
import { privacySettingsService } from "@/services/privacy-settings-service";
import { normalizePath } from "@/lib/path-utils";

type LockSource = "file" | "folder";

export interface LockMatch {
  source: LockSource;
  lockedPath: string;
}

function dedupePaths(paths: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const raw of paths) {
    const value = String(raw).trim();
    if (!value) {
      continue;
    }

    const key = normalizePath(value);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value);
  }

  return output;
}

function mergeLocks(lockedFiles: string[], lockedFolders: string[]): string[] {
  return dedupePaths([...lockedFiles, ...lockedFolders]);
}

function findLockMatch(path: string, lockedFiles: string[], lockedFolders: string[]): LockMatch | null {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) {
    return null;
  }

  for (const lockedFile of lockedFiles) {
    if (normalizePath(lockedFile) === normalizedPath) {
      return { source: "file", lockedPath: lockedFile };
    }
  }

  for (const lockedFolder of lockedFolders) {
    const normalizedFolder = normalizePath(lockedFolder);
    if (!normalizedFolder) {
      continue;
    }

    if (normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`)) {
      return { source: "folder", lockedPath: lockedFolder };
    }
  }

  return null;
}

interface PrivacyStoreState {
  lockedFiles: string[];
  lockedFolders: string[];
  lockedPaths: string[];
  hydrateFromApi: () => Promise<void>;
  lockFile: (path: string) => Promise<void>;
  lockFolder: (path: string) => Promise<void>;
  lockPath: (path: string) => void;
  unlockPath: (path: string) => void;
  getLockMatch: (path: string) => LockMatch | null;
  isLocked: (path: string) => boolean;
}

export const usePrivacyStore = create<PrivacyStoreState>()(
  persist(
    (set, get) => ({
      lockedFiles: [],
      lockedFolders: [],
      lockedPaths: [],
      hydrateFromApi: async () => {
        const remote = await privacySettingsService.getLocks();
        const lockedFiles = dedupePaths(remote.lockFile);
        const lockedFolders = dedupePaths(remote.lockFolder);
        set({
          lockedFiles,
          lockedFolders,
          lockedPaths: mergeLocks(lockedFiles, lockedFolders),
        });
      },
      lockFile: async (path) => {
        const nextPath = path.trim();
        if (!nextPath) {
          return;
        }

        const lockedFiles = dedupePaths([...get().lockedFiles, nextPath]);
        const lockedFolders = dedupePaths(get().lockedFolders);
        set({
          lockedFiles,
          lockedFolders,
          lockedPaths: mergeLocks(lockedFiles, lockedFolders),
        });

        await privacySettingsService.saveLocks({ lockFile: lockedFiles, lockFolder: lockedFolders });
      },
      lockFolder: async (path) => {
        const nextPath = path.trim();
        if (!nextPath) {
          return;
        }

        const lockedFiles = dedupePaths(get().lockedFiles);
        const lockedFolders = dedupePaths([...get().lockedFolders, nextPath]);
        set({
          lockedFiles,
          lockedFolders,
          lockedPaths: mergeLocks(lockedFiles, lockedFolders),
        });

        await privacySettingsService.saveLocks({ lockFile: lockedFiles, lockFolder: lockedFolders });
      },
      lockPath: (path) =>
        set((state) => ({
          lockedFiles: dedupePaths([...state.lockedFiles, path]),
          lockedPaths: mergeLocks(dedupePaths([...state.lockedFiles, path]), state.lockedFolders),
        })),
      unlockPath: (path) =>
        set((state) => {
          const nextLockedFiles = state.lockedFiles.filter((item) => normalizePath(item) !== normalizePath(path));
          const nextLockedFolders = state.lockedFolders.filter((item) => normalizePath(item) !== normalizePath(path));
          const lockedFiles = dedupePaths(nextLockedFiles);
          const lockedFolders = dedupePaths(nextLockedFolders);

          void privacySettingsService.saveLocks({ lockFile: lockedFiles, lockFolder: lockedFolders }).catch(() => undefined);

          return {
            lockedFiles,
            lockedFolders,
            lockedPaths: mergeLocks(lockedFiles, lockedFolders),
          };
        }),
      getLockMatch: (path) => findLockMatch(path, get().lockedFiles, get().lockedFolders),
      isLocked: (path) => findLockMatch(path, get().lockedFiles, get().lockedFolders) !== null,
    }),
    {
      name: "klin-privacy-store",
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<PrivacyStoreState> | undefined) ?? {};
        const lockedFiles = Array.isArray(persisted.lockedFiles)
          ? dedupePaths(persisted.lockedFiles)
          : Array.isArray(persisted.lockedPaths)
            ? dedupePaths(persisted.lockedPaths)
            : [];
        const lockedFolders = Array.isArray(persisted.lockedFolders)
          ? dedupePaths(persisted.lockedFolders)
          : [];

        return {
          ...currentState,
          ...persisted,
          lockedFiles,
          lockedFolders,
          lockedPaths: mergeLocks(lockedFiles, lockedFolders),
        } as PrivacyStoreState;
      },
    },
  ),
);
