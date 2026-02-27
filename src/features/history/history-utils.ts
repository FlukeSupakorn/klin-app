export function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getPathTail(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

export function getFolderTail(value: string) {
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return normalized;
  }

  return parts.slice(0, -1).join("/");
}

export function joinPath(folder: string, fileName: string) {
  const normalizedFolder = folder.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalizedFolder}/${fileName}`;
}
