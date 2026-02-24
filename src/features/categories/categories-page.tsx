import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCategoryStore } from "@/stores/use-category-store";

export function CategoriesPage() {
  const [name, setName] = useState("");
  const { categories, createCategory, deleteCategory, updateCategory } = useCategoryStore();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Categories</h2>
      <Card>
        <CardHeader><CardTitle>Create Category</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Category name" />
          <Button
            onClick={() => {
              if (!name.trim()) return;
              createCategory(name.trim());
              setName("");
            }}
          >
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Category List</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <span>{category.name}</span>
                {category.systemGenerated && <Badge variant="secondary">system</Badge>}
                <Badge variant={category.active ? "default" : "outline"}>{category.active ? "active" : "inactive"}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => updateCategory(category.id, { active: !category.active })}>
                  Toggle
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteCategory(category.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
