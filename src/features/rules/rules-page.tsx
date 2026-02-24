import { useMemo, useState } from "react";
import { FolderPlus, GitBranch, Trash2, FolderOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";
import { cn } from "@/lib/utils";

export function RulesPage() {
  const categories = useCategoryStore((state) => state.categories);
  const { categoryToFolderMap, setMapping, removeMapping } = useRuleStore();
  const [categoryName, setCategoryName] = useState("");
  const [folderPath, setFolderPath] = useState("");

  const activeCategories = useMemo(() => categories.filter(c => c.active), [categories]);
  const availableCategoryNames = useMemo(() => activeCategories.map((item) => item.name), [activeCategories]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">Rules Engine</h2>
          <p className="text-muted-foreground">Map AI categories to your local filesystem folders.</p>
        </div>
        <Card className="flex items-center gap-3 px-4 py-2 shadow-none">
          <GitBranch className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Active Rules</p>
            <p className="text-lg font-semibold">{categoryToFolderMap.length}</p>
          </div>
        </Card>
      </div>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle>Create Rule Mapping</CardTitle>
          <CardDescription>Select a category and specify where files should be moved.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Category</label>
              <Input 
                list="categories-datalist" 
                value={categoryName} 
                onChange={(event) => setCategoryName(event.target.value)} 
                placeholder="Choose a category..." 
                className="bg-background"
              />
              <datalist id="categories-datalist">
                {availableCategoryNames.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Target Folder Path</label>
              <div className="flex gap-2">
                <Input 
                  value={folderPath} 
                  onChange={(event) => setFolderPath(event.target.value)} 
                  placeholder="C:/Users/Documents/Work" 
                  className="bg-background"
                />
              </div>
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
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {categoryToFolderMap.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-muted p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <GitBranch className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">No rules defined yet</h3>
            <p className="text-muted-foreground">Add your first category-to-folder mapping above to start organizing.</p>
          </div>
        ) : (
          categoryToFolderMap.map((mapping) => (
            <Card key={mapping.categoryName} className="group overflow-hidden transition-all hover:shadow-md">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Category</p>
                      <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">{mapping.categoryName}</Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Destination</p>
                      <p className="font-mono text-sm">{mapping.folderPath}</p>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeMapping(mapping.categoryName)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
