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
