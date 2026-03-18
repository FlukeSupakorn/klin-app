export type OnboardingStep =
  | "welcome"
  | "base-path"
  | "categories"
  | "watcher"
  | "complete";

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  isDefault: boolean;
}

export interface WatcherFolder {
  id: string;
  path: string;
  recursive: boolean;
}

export interface OnboardingState {
  step: OnboardingStep;
  basePath: string;
  categories: Category[];
  watcherFolders: WatcherFolder[];
}
// Remove this later, just for testing
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "documents",
    name: "Documents",
    icon: "FileText",
    description: "PDFs, Word docs, spreadsheets and text files",
    color: "blue",
    isDefault: true,
  },
  {
    id: "images",
    name: "Images",
    icon: "Image",
    description: "Photos, screenshots, illustrations and graphics",
    color: "purple",
    isDefault: true,
  },
  {
    id: "videos",
    name: "Videos",
    icon: "Film",
    description: "Movies, screen recordings and video clips",
    color: "red",
    isDefault: true,
  },
  {
    id: "audio",
    name: "Audio",
    icon: "Music",
    description: "Music, podcasts, voice memos and sound files",
    color: "green",
    isDefault: true,
  },
  {
    id: "code",
    name: "Code & Dev",
    icon: "Code2",
    description: "Source files, configs, scripts and dev assets",
    color: "cyan",
    isDefault: true,
  },
  {
    id: "archives",
    name: "Archives",
    icon: "Archive",
    description: "ZIP, TAR, RAR and other compressed files",
    color: "orange",
    isDefault: true,
  },
  {
    id: "design",
    name: "Design",
    icon: "Palette",
    description: "Figma, Sketch, PSD and design assets",
    color: "pink",
    isDefault: true,
  },
  {
    id: "data",
    name: "Data & Reports",
    icon: "BarChart2",
    description: "CSV, JSON, XML and analytical data files",
    color: "yellow",
    isDefault: true,
  },
];

export const STEPS: { id: OnboardingStep; label: string; shortLabel: string }[] = [
  { id: "welcome", label: "Welcome", shortLabel: "Welcome" },
  { id: "base-path", label: "Base Path", shortLabel: "Base Path" },
  { id: "categories", label: "Categories", shortLabel: "Categories" },
  { id: "watcher", label: "Watcher", shortLabel: "Watcher" },
  { id: "complete", label: "All Set", shortLabel: "Done" },
];
