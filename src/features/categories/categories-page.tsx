import { useState } from "react";
import { Plus, Tag, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCategoryStore } from "@/stores/use-category-store";
import { cn } from "@/lib/utils";

export function CategoriesPage() {
  const [name, setName] = useState("");
  const { categories, createCategory, deleteCategory, updateCategory } = useCategoryStore();

  const activeCount = categories.filter(c => c.active).length;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">Categories</h2>
          <p className="text-muted-foreground">Define how AI classifies your files.</p>
        </div>
        <div className="flex gap-4">
          <Card className="flex items-center gap-3 px-4 py-2 shadow-none">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Active</p>
              <p className="text-lg font-semibold">{activeCount}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 px-4 py-2 shadow-none">
            <Tag className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total</p>
              <p className="text-lg font-semibold">{categories.length}</p>
            </div>
          </Card>
        </div>
      </div>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle>Add New Category</CardTitle>
          <CardDescription>Enter a name for the AI to use as a classification target.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-md gap-2">
            <Input 
              value={name} 
              onChange={(event) => setName(event.target.value)} 
              placeholder="e.g. Work Documents, Financial, Personal" 
              className="bg-background"
            />
            <Button
              onClick={() => {
                if (!name.trim()) return;
                createCategory(name.trim());
                setName("");
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add Category
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className={cn(
            "group relative transition-all hover:shadow-md",
            !category.active && "opacity-70 bg-muted/30"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{category.name}</CardTitle>
                  <div className="flex gap-2">
                    {category.systemGenerated && (
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold">System</Badge>
                    )}
                    <Badge 
                      variant={category.active ? "default" : "outline"}
                      className={cn("text-[10px] uppercase font-bold", category.active ? "bg-green-500/10 text-green-600 border-green-500/20" : "")}
                    >
                      {category.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 transition-colors group-hover:bg-primary/10">
                  <Tag className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex justify-end gap-2 pt-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => updateCategory(category.id, { active: !category.active })}
                className="text-xs"
              >
                {category.active ? <XCircle className="mr-2 h-3 w-3" /> : <CheckCircle2 className="mr-2 h-3 w-3" />}
                {category.active ? "Deactivate" : "Activate"}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => deleteCategory(category.id)}
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-2 h-3 w-3" /> Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
