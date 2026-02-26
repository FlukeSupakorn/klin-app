import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationLog, Category } from "@/types/domain";

interface CategoryDistributionCardProps {
  categories: Category[];
  logs: AutomationLog[];
}

export function CategoryDistributionCard({ categories, logs }: CategoryDistributionCardProps) {
  const activeCategories = categories.filter((category) => category.active);

  return (
    <Card className="rounded-3xl border-0 bg-muted/40 shadow-none">
      <CardHeader>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Category Distribution</CardTitle>
        </div>
        <CardDescription>File count by category.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {activeCategories.slice(0, 6).map((category) => {
          const count = logs.filter((log) => log.chosenCategory === category.name).length;
          const percentage = logs.length ? (count / logs.length) * 100 : 0;

          return (
            <div key={category.id} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{category.name}</span>
                <span className="text-muted-foreground">
                  {count} files ({Math.round(percentage)}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        {activeCategories.length === 0 && (
          <p className="py-10 text-center text-sm italic text-muted-foreground">
            No active categories. Create some to see distribution.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
