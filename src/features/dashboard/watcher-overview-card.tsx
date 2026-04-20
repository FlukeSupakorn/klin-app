import { Link } from "react-router-dom";
import { FolderOpen, Settings2 } from "lucide-react";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";

export function WatcherOverviewCard() {
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const categories = useCategoryManagementStore((state) => state.categories);
  const activeCategories = categories.filter((c) => c.enabled);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Overview</p>
          <h3 className="font-black">Watcher</h3>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderOpen className="h-4 w-4" />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Folders</p>
          <p className="text-xl font-black text-secondary">{watchedFolders.length}</p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categories</p>
          <p className="text-xl font-black text-primary">{activeCategories.length}</p>
        </div>
      </div>

      {activeCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeCategories.slice(0, 4).map((cat) => (
            <span
              key={cat.id}
              className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary"
            >
              {cat.name}
            </span>
          ))}
          {activeCategories.length > 4 && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              +{activeCategories.length - 4}
            </span>
          )}
        </div>
      )}

      {activeCategories.length === 0 && watchedFolders.length === 0 && (
        <p className="text-xs text-muted-foreground">No folders or categories configured yet.</p>
      )}

      <Link
        to="/settings"
        className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings2 className="h-3 w-3" />
        Configure
      </Link>
    </div>
  );
}
