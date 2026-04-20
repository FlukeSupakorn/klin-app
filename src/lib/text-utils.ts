/**
 * Text utility functions
 */

export function normalizeCategoryLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeCategoryName(value: string): string {
  return value.trim().toLowerCase();
}
