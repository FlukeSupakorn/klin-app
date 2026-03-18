import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart2,
  Briefcase,
  Code2,
  FileText,
  Film,
  FolderOpen,
  GraduationCap,
  HeartPulse,
  Image,
  Music,
  Palette,
  Plane,
  Receipt,
  Scale,
  User,
} from "lucide-react";

export interface CategoryIconOption {
  name: string;
  label: string;
  icon: LucideIcon;
}

export interface CategoryColorOption {
  name: string;
  value: string;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { name: "FileText", label: "Document", icon: FileText },
  { name: "Image", label: "Image", icon: Image },
  { name: "Film", label: "Video", icon: Film },
  { name: "Music", label: "Audio", icon: Music },
  { name: "Code2", label: "Code", icon: Code2 },
  { name: "Archive", label: "Archive", icon: Archive },
  { name: "Palette", label: "Design", icon: Palette },
  { name: "BarChart2", label: "Data", icon: BarChart2 },
  { name: "Briefcase", label: "Work", icon: Briefcase },
  { name: "Receipt", label: "Finance", icon: Receipt },
  { name: "Scale", label: "Legal", icon: Scale },
  { name: "GraduationCap", label: "Education", icon: GraduationCap },
  { name: "User", label: "Personal", icon: User },
  { name: "Plane", label: "Travel", icon: Plane },
  { name: "HeartPulse", label: "Health", icon: HeartPulse },
  { name: "FolderOpen", label: "Folder", icon: FolderOpen },
];

const ICON_BY_NAME = new Map(CATEGORY_ICON_OPTIONS.map((option) => [option.name, option.icon]));

export const CATEGORY_COLOR_OPTIONS: CategoryColorOption[] = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#f59e0b" },
  { name: "Slate", value: "#64748b" },
  { name: "Stone", value: "#78716c" },
];

export function getCategoryIcon(iconName?: string | null): LucideIcon {
  if (!iconName) {
    return FileText;
  }
  return ICON_BY_NAME.get(iconName) ?? FileText;
}

export function withAlpha(hex: string, alphaHex: string): string {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#6366f1";
  return `${normalized}${alphaHex}`;
}
