import { Tags } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ManagedCategory } from "@/types/domain";

interface ActiveCategoriesCardProps {
  activeManagedCategories: ManagedCategory[];
  onOpenCategoryManager: () => void;
}

export function ActiveCategoriesCard({
  activeManagedCategories,
  onOpenCategoryManager,
}: ActiveCategoriesCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpenCategoryManager}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenCategoryManager();
        }
      }}
      className="group cursor-pointer border border-border bg-card shadow-none transition-all duration-150 hover:border-primary/30 hover:bg-muted"
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categories</p>
            <h3 className="mt-0.5 text-lg font-black text-foreground">Active</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Tags className="h-5 w-5" />
          </div>
        </div>

        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-4xl font-black text-primary">{activeManagedCategories.length}</span>
          <span className="text-sm font-bold text-muted-foreground">categories</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {activeManagedCategories.slice(0, 4).map((category) => (
            <span
              key={category.id}
              className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground"
            >
              {category.name}
            </span>
          ))}
          {activeManagedCategories.length > 4 && (
            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              +{activeManagedCategories.length - 4}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
