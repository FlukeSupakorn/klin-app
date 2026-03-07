import type { NoteFileEntryDto } from "@/types/ipc";
import { tauriClient } from "@/services/tauri-client";

const NOTES_FOLDER_NAME = "notes";

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
};
