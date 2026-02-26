import { ArrowUpRight, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      className="group cursor-pointer border-0 bg-muted/40 shadow-none transition-all hover:bg-muted/60"
    >
      <CardContent className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-primary">
              <Tags className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">Classification</p>
              <h3 className="text-xl font-semibold">Active Categories</h3>
            </div>
          </div>
          <Badge variant="secondary" className="bg-background">
            {activeManagedCategories.length} active
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {activeManagedCategories.slice(0, 3).map((category) => (
              <Badge key={category.id} variant="outline" className="bg-background text-xs">
                {category.name}
              </Badge>
            ))}
            {activeManagedCategories.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{activeManagedCategories.length - 3} more
              </Badge>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background transition-transform group-hover:-translate-y-1 group-hover:translate-x-1">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
