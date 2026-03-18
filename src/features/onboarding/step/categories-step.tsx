import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Category } from "../types";
import {
  Archive,
  BarChart2,
  Check,
  Code2,
  Film,
  FileText,
  Image,
  Music,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  Image,
  Film,
  Music,
  Code2,
  Archive,
  Palette,
  BarChart2,
};

const COLOR_MAP: Record<string, string> = {
  blue: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  red: "text-red-400 bg-red-400/10 border-red-400/20",
  green: "text-green-400 bg-green-400/10 border-green-400/20",
  cyan: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  orange: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  pink: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  yellow: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
};

const CUSTOM_COLORS = [
  "blue",
  "purple",
  "red",
  "green",
  "cyan",
  "orange",
  "pink",
  "yellow",
];

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
    color: "blue",
  });

  const removeCategory = (id: string) => {
    onCategoriesChange(categories.filter((c) => c.id !== id));
  };

  const addCategory = () => {
    if (!form.name.trim()) return;
    const newCat: Category = {
      id: `custom-${Date.now()}`,
      name: form.name.trim(),
      icon: "FileText",
      description: form.description.trim() || "Custom category",
      color: form.color,
      isDefault: false,
    };
    onCategoriesChange([...categories, newCat]);
    setForm({ name: "", description: "", color: "blue" });
    setShowAddForm(false);
  };

  const enabledCount = categories.length;

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[--brand] mb-1">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-widest">
            Step 3 of 4
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
          const Icon = ICON_MAP[cat.icon] ?? FileText;
          const colorClass = COLOR_MAP[cat.color] ?? COLOR_MAP.blue;
          return (
            <div
              key={cat.id}
              className={cn(
                "group relative flex items-start gap-3 p-3 rounded-xl border transition-all duration-200",
                "bg-[--surface-2] hover:bg-[--surface-3]",
                "border-[--border] hover:border-[--brand]/30"
              )}
            >
              {/* Icon badge */}
              <div
                className={cn(
                  "w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0",
                  colorClass
                )}
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
          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[--border] hover:border-[--brand]/50 hover:bg-[--brand-dim] transition-all duration-200 text-muted-foreground hover:text-[--brand] min-h-[72px]"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[11px] font-medium">Add category</span>
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-[--brand]/30 bg-[--brand-dim] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[--brand] font-mono uppercase tracking-widest">
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
            className="w-full px-3 py-2 rounded-lg bg-[--surface-2] border border-[--border] focus:border-[--brand] focus:ring-2 focus:ring-[--brand]/20 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Short description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[--surface-2] border border-[--border] focus:border-[--brand] focus:ring-2 focus:ring-[--brand]/20 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
          />
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Color
            </p>
            <div className="flex gap-2 flex-wrap">
              {CUSTOM_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setForm({ ...form, color })}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    {
                      blue: "bg-blue-400",
                      purple: "bg-purple-400",
                      red: "bg-red-400",
                      green: "bg-green-400",
                      cyan: "bg-cyan-400",
                      orange: "bg-orange-400",
                      pink: "bg-pink-400",
                      yellow: "bg-yellow-400",
                    }[color],
                    form.color === color
                      ? "border-foreground scale-110"
                      : "border-transparent scale-100"
                  )}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={addCategory}
            disabled={!form.name.trim()}
            className="w-full h-9 bg-[--brand] hover:bg-[--brand]/90 text-[--brand-foreground] text-xs font-semibold border-0"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Category
          </Button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[--surface-2] border border-[--border]">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{enabledCount}</span> categories active
        </span>
        <div className="flex-1 h-px bg-[--border]" />
        <span className="text-[11px] text-muted-foreground font-mono">
          KLIN will create {enabledCount} subfolders in your base path
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex-1 px-5 text-muted-foreground hover:text-foreground border border-[--border] bg-transparent hover:bg-[--surface-2]"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex-[2] font-semibold border-0"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
