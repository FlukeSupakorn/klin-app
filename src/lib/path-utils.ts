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
