import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCategoryStore } from "@/stores/use-category-store";
import { useRuleStore } from "@/stores/use-rule-store";

export function RulesPage() {
  const categories = useCategoryStore((state) => state.categories);
  const { categoryToFolderMap, setMapping, removeMapping } = useRuleStore();
  const [categoryName, setCategoryName] = useState("");
  const [folderPath, setFolderPath] = useState("");

  const availableCategoryNames = useMemo(() => categories.map((item) => item.name), [categories]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Rules Engine</h2>
      <Card>
        <CardHeader><CardTitle>Category → Folder Mapping</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input list="categories" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Category" />
          <datalist id="categories">
            {availableCategoryNames.map((name) => <option key={name} value={name} />)}
          </datalist>
          <Input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} placeholder="Target folder path" />
          <Button
            onClick={() => {
              if (!categoryName.trim() || !folderPath.trim()) return;
              setMapping(categoryName.trim(), folderPath.trim(), true);
              setCategoryName("");
              setFolderPath("");
            }}
          >
            Save Mapping
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mappings</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {categoryToFolderMap.map((mapping) => (
            <div key={mapping.categoryName} className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm">
                <p className="font-medium">{mapping.categoryName}</p>
                <p className="text-muted-foreground">{mapping.folderPath}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeMapping(mapping.categoryName)}>Remove</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
