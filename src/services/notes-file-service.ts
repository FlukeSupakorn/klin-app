import type { NoteFileEntryDto } from "@/types/ipc";
import { tauriClient } from "@/services/tauri-client";

const NOTES_FOLDER_NAME = "notes";
const SAVED_PATHS_CACHE_FILE = ".saved-paths.json";

interface SavedPathEntry {
  path: string;
  savedAt: string;
}

export interface NoteFileItem {
  path: string;
  fileName: string;
  sizeBytes: number;
  lastModifiedMs: number;
}

function normalizeFileName(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return "Quick-Note";
  }

  const withoutMd = trimmed.toLowerCase().endsWith(".md")
    ? trimmed.slice(0, -3)
    : trimmed;

  return withoutMd.trim() || "Quick-Note";
}

function joinPath(basePath: string, segment: string): string {
  const normalizedBase = basePath.replace(/[\\/]+$/, "");
  return `${normalizedBase}/${segment}`;
}

function mapNoteFile(entry: NoteFileEntryDto): NoteFileItem {
  return {
    path: entry.path,
    fileName: entry.file_name,
    sizeBytes: entry.size_bytes,
    lastModifiedMs: entry.last_modified_ms,
  };
}

export const notesFileService = {
  async getAppNotesFolderPath(): Promise<string> {
    const appDataDir = await tauriClient.getAppDataDir();
    return joinPath(appDataDir, NOTES_FOLDER_NAME);
  },

  async listAppNotes(): Promise<NoteFileItem[]> {
    const notesFolderPath = await this.getAppNotesFolderPath();
    const files = await tauriClient.listNoteFiles(notesFolderPath);
    return files.map(mapNoteFile);
  },

  async readNote(filePath: string): Promise<string> {
    return tauriClient.readNoteFile(filePath);
  },

  async saveToFolder(folderPath: string, fileName: string, content: string): Promise<string> {
    return tauriClient.saveNoteFile({
      folderPath,
      fileName: normalizeFileName(fileName),
      content,
    });
  },

  async saveToAppFolder(fileName: string, content: string): Promise<string> {
    const appNotesFolderPath = await this.getAppNotesFolderPath();
    return this.saveToFolder(appNotesFolderPath, fileName, content);
  },

  async getCachePath(): Promise<string> {
    const appDataDir = await tauriClient.getAppDataDir();
    return joinPath(appDataDir, `${NOTES_FOLDER_NAME}/${SAVED_PATHS_CACHE_FILE}`);
  },

  async readSavedPathsCache(): Promise<SavedPathEntry[]> {
    try {
      const cachePath = await this.getCachePath();
      const content = await tauriClient.readNoteFile(cachePath);
      return JSON.parse(content) as SavedPathEntry[];
    } catch {
      return [];
    }
  },

  async appendToSavedPathsCache(filePath: string): Promise<void> {
    const existing = await this.readSavedPathsCache();
    if (existing.some((e) => e.path === filePath)) return;
    const updated = [...existing, { path: filePath, savedAt: new Date().toISOString() }];
    const cachePath = await this.getCachePath();
    await tauriClient.writeTextFile(cachePath, JSON.stringify(updated, null, 2));
  },

  async listCachedNotes(): Promise<NoteFileItem[]> {
    const entries = await this.readSavedPathsCache();
    if (entries.length === 0) return [];

    const paths = entries.map((e) => e.path);
    const stats = await tauriClient.statFiles(paths);

    const alive: SavedPathEntry[] = [];
    const results: NoteFileItem[] = [];

    stats.forEach((stat, i) => {
      if (!stat) return;
      alive.push(entries[i]);
      results.push(mapNoteFile(stat));
    });

    // Prune stale entries from cache if any were removed
    if (alive.length !== entries.length) {
      const cachePath = await this.getCachePath();
      await tauriClient.writeTextFile(cachePath, JSON.stringify(alive, null, 2));
    }

    return results;
  },
};
