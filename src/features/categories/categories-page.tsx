import { useState } from "react";
import { Plus, Tag, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCategoryStore } from "@/stores/use-category-store";
import { useLogStore } from "@/stores/use-log-store";
import { cn } from "@/lib/utils";

export function CategoriesPage() {
  const [name, setName] = useState("");
  const categories = useCategoryStore((state) => state.categories);
  const createCategory = useCategoryStore((state) => state.createCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);
  const updateCategory = useCategoryStore((state) => state.updateCategory);
  const logs = useLogStore((state) => state.logs);

  const activeCount = categories.filter(c => c.active).length;

  const chartData = categories
    .filter(c => c.active)
    .map((cat, i) => ({
      name: cat.name.length > 10 ? cat.name.slice(0, 10) + "…" : cat.name,
      count: logs.filter(l => l.chosenCategory === cat.name).length,
      fill: i % 2 === 0 ? "hsl(75 100% 44%)" : "hsl(27 96% 53%)",
    }))
    .slice(0, 8);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Management</p>
          <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Categories</h2>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active</p>
            <p className="text-xl font-black text-primary">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
            <p className="text-xl font-black text-foreground">{categories.length}</p>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <Card className="border border-border bg-card shadow-none">
          <CardHeader className="pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Distribution</p>
            <CardTitle className="text-base font-black">Files per Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(0 0% 55%)", fontSize: 10, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(0 0% 16%)" }}
                  contentStyle={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(0 0% 96%)", fontWeight: 700 }}
                  itemStyle={{ color: "hsl(0 0% 55%)" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border bg-card shadow-none">
        <CardHeader className="pb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Category</p>
          <CardTitle className="text-base font-black">Add Category</CardTitle>
          <CardDescription>Enter a name for the AI to use as a classification target.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-md gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Work Documents, Financial, Personal"
              className="border-border bg-muted/50 focus-visible:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  createCategory(name.trim());
                  setName("");
                }
              }}
            />
            <Button
              onClick={() => {
                if (!name.trim()) return;
                createCategory(name.trim());
                setName("");
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card
            key={category.id}
            className={cn(
              "group border border-border bg-card shadow-none transition-all duration-150 hover:border-primary/30",
              !category.active && "opacity-50",
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-black">{category.name}</CardTitle>
                  <div className="flex gap-1.5 flex-wrap">
                    {category.systemGenerated && (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-black uppercase text-muted-foreground">System</span>
                    )}
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase",
                        category.active
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {category.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Tag className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex justify-end gap-1 pt-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateCategory(category.id, { active: !category.active })}
                className="h-7 text-xs"
              >
                {category.active ? <XCircle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                {category.active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteCategory(category.id)}
                className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
