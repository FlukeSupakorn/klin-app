import { CalendarDays, FileText, FolderSync } from "lucide-react";
import type { HistoryEntryType } from "@/features/history/history-types";

type ActionTheme = {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconWrap: string;
  iconColor: string;
  emphasis: string;
  badge: string;
  filterSelected: string;
  filterIdle: string;
};

type StatusTheme = {
  successText: string;
  successMutedText: string;
  successBadge: string;
  successSurface: string;
  successSurfaceHover: string;
  successBorder: string;
  aiLearnedDot: string;
  warningText: string;
  warningMutedText: string;
  warningDot: string;
};

type AppTheme = {
  primary: string;
  secondary: string;
  dark: string;
};

type CalendarTheme = {
  defaultEventColor: string;
};

export const theme: {
  app: AppTheme;
  status: StatusTheme;
  calendar: CalendarTheme;
  actions: Record<HistoryEntryType, ActionTheme>;
} = {
  app: {
    primary: "text-primary",
    secondary: "text-muted-foreground",
    dark: "text-foreground",
  },
  status: {
    successText: "text-green-500",
    successMutedText: "text-green-600",
    successBadge: "bg-green-500 hover:bg-green-600",
    successSurface: "bg-green-500/10",
    successSurfaceHover: "hover:bg-green-500/10",
    successBorder: "border-green-500/20",
    aiLearnedDot: "bg-emerald-500",
    warningText: "text-amber-500",
    warningMutedText: "text-yellow-500",
    warningDot: "bg-amber-400",
  },
  calendar: {
    defaultEventColor: "#3B82F6",
  },
  actions: {
    organize: {
      icon: FolderSync,
      accent: "bg-blue-500/40",
      iconWrap: "bg-blue-500/10 border-blue-500/30",
      iconColor: "text-blue-600",
      emphasis: "text-blue-600",
      badge: "border-blue-500/30 text-blue-700 bg-blue-500/10",
      filterSelected: "border-blue-500/40 bg-blue-500/15 text-blue-700 hover:bg-blue-500/20",
      filterIdle: "border-blue-500/30 text-blue-700 hover:bg-blue-500/10",
    },
    summary: {
      icon: FileText,
      accent: "bg-violet-500/40",
      iconWrap: "bg-violet-500/10 border-violet-500/30",
      iconColor: "text-violet-600",
      emphasis: "text-violet-600",
      badge: "border-violet-500/30 text-violet-700 bg-violet-500/10",
      filterSelected: "border-violet-500/40 bg-violet-500/15 text-violet-700 hover:bg-violet-500/20",
      filterIdle: "border-violet-500/30 text-violet-700 hover:bg-violet-500/10",
    },
    calendar: {
      icon: CalendarDays,
      accent: "bg-emerald-500/40",
      iconWrap: "bg-emerald-500/10 border-emerald-500/30",
      iconColor: "text-emerald-600",
      emphasis: "text-emerald-600",
      badge: "border-emerald-500/30 text-emerald-700 bg-emerald-500/10",
      filterSelected: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20",
      filterIdle: "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10",
    },
  },
};