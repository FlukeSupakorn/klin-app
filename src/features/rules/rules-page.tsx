import { useMemo, useState } from "react";
import { FolderPlus, GitBranch, Trash2, FolderOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";

export function RulesPage() {
  const categories = useCategoryStore((state) => state.categories);
  const { categoryToFolderMap, setMapping, removeMapping } = useRuleStore();
  const [categoryName, setCategoryName] = useState("");
  const [folderPath, setFolderPath] = useState("");

  const activeCategories = useMemo(() => categories.filter(c => c.active), [categories]);
  const availableCategoryNames = useMemo(() => activeCategories.map((item) => item.name), [activeCategories]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Routing</p>
          <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Rules Engine</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{categoryToFolderMap.length} rules</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Configuration</p>
          <h3 className="font-black">Create Rule Mapping</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
            <Input
              list="categories-datalist"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Choose a category..."
              className="border-border bg-muted"
            />
            <datalist id="categories-datalist">
              {availableCategoryNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Folder Path</label>
            <Input
              value={folderPath}
              onChange={(event) => setFolderPath(event.target.value)}
              placeholder="C:/Users/Documents/Work"
              className="border-border bg-muted"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                if (!categoryName.trim() || !folderPath.trim()) return;
                setMapping(categoryName.trim(), folderPath.trim(), true);
                setCategoryName("");
                setFolderPath("");
              }}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" /> Save Rule
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {categoryToFolderMap.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <GitBranch className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-black">No rules defined yet</p>
            <p className="text-sm text-muted-foreground">Add a category-to-folder mapping above.</p>
          </div>
        ) : (
          categoryToFolderMap.map((mapping) => (
            <div key={mapping.categoryName} className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-black">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</p>
                    <Badge variant="secondary" className="bg-muted text-foreground">{mapping.categoryName}</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Destination</p>
                    <p className="font-mono text-sm">{mapping.folderPath}</p>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeMapping(mapping.categoryName)}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
