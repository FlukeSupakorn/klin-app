/**
 * Path utility functions
 */

export function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

export function splitDestinationPath(
  destinationPath: string
): { folderPath: string; fileName: string } {
  const slashIndex = Math.max(
    destinationPath.lastIndexOf("/"),
    destinationPath.lastIndexOf("\\")
  );
  if (slashIndex < 0) {
    return { folderPath: "", fileName: destinationPath };
  }

  return {
    folderPath: destinationPath.slice(0, slashIndex),
    fileName: destinationPath.slice(slashIndex + 1),
  };
}

export function getPathName(path: string): string {
  const name = path.split(/[\\/]/).pop()?.trim();
  return name && name.length > 0 ? name : path;
}

export function getPathTail(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

export function getFolderTail(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return normalized;
  }

  return parts.slice(0, -1).join("/");
}

export function joinPath(folder: string, fileName: string): string {
  const normalizedFolder = folder.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalizedFolder}/${fileName}`;
}

// Join a base folder path with a sub-name using the OS-native separator
// detected from the base path itself (Windows drive letter → backslash, else forward slash).
export function joinFolderPath(basePath: string, name: string): string {
  const base = basePath.trim().replace(/[/\\]+$/, "");
  const sep = /^[A-Za-z]:/.test(base) ? "\\" : "/";
  return base ? `${base}${sep}${name.trim()}` : name.trim();
}

// Normalize path separators to match the OS convention inferred from the path.
// Windows absolute paths start with a drive letter (e.g. C:\); all others use forward slashes.
export function normalizeOsPath(p: string): string {
  if (/^[A-Za-z]:/.test(p)) return p.replace(/\//g, "\\");
  return p.replace(/\\/g, "/");
}
