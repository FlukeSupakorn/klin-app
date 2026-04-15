/**
 * Category utility functions
 */

export function findCategoryColor(
  name: string,
  palette: Array<{ name: string; color: string }>
): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const matched = palette.find(
    (item) => item.name.trim().toLowerCase() === normalized
  );
  return matched?.color ?? null;
}
