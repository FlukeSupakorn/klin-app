import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/onboarding";
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  getCategoryIcon,
  withAlpha,
} from "@/features/categories/category-appearance";
import {
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface CategoriesStepProps {
  categories: Category[];
  onCategoriesChange: (cats: Category[]) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface AddFormState {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export function CategoriesStep({
  categories,
  onCategoriesChange,
  onNext,
  onBack,
  onSkip,
}: CategoriesStepProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddFormState>({
    name: "",
    description: "",
    color: "#3b82f6",
    icon: "FileText",
  });

  const removeCategory = (id: string) => {
    onCategoriesChange(categories.filter((c) => c.id !== id));
  };

  const addCategory = () => {
    if (!form.name.trim()) return;
    const newCat: Category = {
      id: `custom-${Date.now()}`,
      name: form.name.trim(),
      icon: form.icon,
      description: form.description.trim() || "Custom category",
      color: form.color,
      isDefault: false,
    };
    onCategoriesChange([...categories, newCat]);
    setForm({ name: "", description: "", color: "#3b82f6", icon: "FileText" });
    setShowAddForm(false);
  };

  const enabledCount = categories.length;

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="mb-1 flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Step 2 of 4
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Categories</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1 text-pretty">
              We&apos;ve initialized {categories.filter((c) => c.isDefault).length} smart
              defaults. Remove any you don&apos;t need, or add your own.
            </p>
          </div>
        </div>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 custom-scroll">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          return (
            <div
              key={cat.id}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 transition-all duration-200",
                "hover:border-primary/30"
              )}
            >
              {/* Icon badge */}
              <div
                className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                style={{
                  color: cat.color,
                  borderColor: withAlpha(cat.color, "66"),
                  backgroundColor: withAlpha(cat.color, "1a"),
                }}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {cat.name}
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
              </div>
              {/* Remove button */}
              <button
                onClick={() => removeCategory(cat.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-all"
                title="Remove category"
              >
                {cat.isDefault ? (
                  <X className="w-3 h-3" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            </div>
          );
        })}

        {/* Add new tile */}
        <button
          onClick={() => setShowAddForm(true)}
          className="min-h-18 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[11px] font-medium">Add category</span>
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              New Category
            </p>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Category name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="text"
            placeholder="Short description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Icon
            </p>
            <div className="grid grid-cols-8 gap-1.5">
              {CATEGORY_ICON_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.name}
                    onClick={() => setForm({ ...form, icon: option.name })}
                    className={cn(
                      "h-7 w-7 rounded-md border flex items-center justify-center transition-all",
                      form.icon === option.name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                    title={option.label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Color
            </p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setForm({ ...form, color: option.value })}
                  className={cn("w-6 h-6 rounded-full border-2 transition-all", form.color === option.value
                    ? "border-foreground scale-110"
                    : "border-transparent scale-100")}
                  style={{ backgroundColor: option.value }}
                  title={option.name}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={addCategory}
            disabled={!form.name.trim()}
            className="h-9 w-full text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Category
          </Button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{enabledCount}</span> categories active
        </span>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground font-mono">
          KLIN will create {enabledCount} subfolders in your base path
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1 border border-border bg-transparent px-5 text-muted-foreground hover:bg-muted hover:text-foreground">
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex-2 font-semibold"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
