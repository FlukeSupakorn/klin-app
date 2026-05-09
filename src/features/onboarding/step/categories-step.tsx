import { useState } from "react";
import type { Category } from "@/types/onboarding";
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  getCategoryIcon,
  withAlpha,
} from "@/features/categories/category-appearance";
import {
  Layers,
  Plus,
  Sparkles,
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

const DEFAULT_FORM: AddFormState = {
  name: "",
  description: "",
  color: "#3b82f6",
  icon: "FileText",
};

export function CategoriesStep({
  categories,
  onCategoriesChange,
}: CategoriesStepProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddFormState>(DEFAULT_FORM);

  const removeCategory = (id: string) => {
    onCategoriesChange(categories.filter((c) => c.id !== id));
  };

  const toggleCategory = (id: string) => {
    onCategoriesChange(
      categories.map((cat) =>
        cat.id === id
          ? { ...cat, enabled: !(cat.enabled !== false) }
          : cat,
      ),
    );
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
      enabled: true,
    };
    onCategoriesChange([...categories, newCat]);
    setForm(DEFAULT_FORM);
    setShowAddForm(false);
  };

  const enabledCount = categories.filter((cat) => cat.enabled !== false).length;

  return (
    <div
      className="klin-fade-in"
      style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 660, margin: "0 auto", flex: 1, minHeight: 0 }}
    >
      {/* Header */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 11px 5px 8px",
          borderRadius: 20,
          background: "rgba(15,98,254,.11)",
          marginBottom: 14,
        }}
      >
        <Sparkles className="h-3.5 w-3.5" style={{ color: "#0F62FE" }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0F62FE", textTransform: "uppercase", letterSpacing: ".1em" }}>
          Step 2 of 4 · Categories
        </span>
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.6px", color: "#181e35", marginBottom: 8 }}>
        Pick your AI categories
      </h2>
      <p style={{ fontSize: 14, color: "#6b7a9a", lineHeight: 1.6, marginBottom: 18, maxWidth: 560 }}>
        We&apos;ve initialized {categories.length} smart defaults. Toggle any off, remove ones you don&apos;t need, or add your own.
      </p>

      {/* Status bar */}
      <div
        style={{
          padding: "13px 18px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "#fff",
          borderRadius: 18,
          border: "1.5px solid #e4eafc",
          boxShadow: "0 2px 8px rgba(15,98,254,.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "#0F62FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers className="h-3.5 w-3.5" style={{ color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#181e35" }}>
              {enabledCount} categories active
            </div>
            <div style={{ fontSize: 11, color: "#a8b4cc", fontFamily: "'JetBrains Mono', monospace" }}>
              {enabledCount} subfolders will be created
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: 10,
            background: "rgba(16,185,129,.1)",
            color: "#10b981",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          AI ready
        </span>
      </div>

      {/* Category grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridAutoRows: "max-content",
          gap: 10,
          marginBottom: 14,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {/* Add card (rendered first so it sits at the top of the grid) */}
        {showAddForm ? (
          <div
            style={{
              gridColumn: "1 / -1",
              background: "#fff",
              borderRadius: 14,
              border: "1.5px solid #0F62FE",
              padding: 14,
              boxShadow: "0 0 0 3px rgba(15,98,254,.08)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            className="klin-slide-up"
          >
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Category name (e.g. Receipts)"
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                border: "1.5px solid #e4eafc",
                outline: "none",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                color: "#181e35",
                background: "#f4f7ff",
              }}
            />
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description"
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                border: "1.5px solid #e4eafc",
                outline: "none",
                fontSize: 12,
                fontFamily: "inherit",
                color: "#181e35",
                background: "#f4f7ff",
              }}
            />

            {/* Icon picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: "#6b7a9a",
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Icon
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: 6,
                }}
              >
                {CATEGORY_ICON_OPTIONS.map((option) => {
                  const OptionIcon = option.icon;
                  const selected = form.icon === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => setForm({ ...form, icon: option.name })}
                      title={option.label}
                      style={{
                        height: 30,
                        borderRadius: 8,
                        border: selected ? "1.5px solid #0F62FE" : "1.5px solid #e4eafc",
                        background: selected ? withAlpha(form.color, "15") : "#fff",
                        color: selected ? form.color : "#6b7a9a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all .15s",
                      }}
                    >
                      <OptionIcon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: "#6b7a9a",
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Color
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CATEGORY_COLOR_OPTIONS.map((option) => {
                  const selected = form.color === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm({ ...form, color: option.value })}
                      title={option.name}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: selected ? "2px solid #181e35" : "2px solid transparent",
                        background: option.value,
                        cursor: "pointer",
                        transform: selected ? "scale(1.1)" : "scale(1)",
                        transition: "all .15s",
                        padding: 0,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setForm(DEFAULT_FORM);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all .15s",
                  whiteSpace: "nowrap",
                  gap: 5,
                  padding: "7px 13px",
                  fontSize: 12,
                  background: "#fff",
                  color: "#6b7a9a",
                  border: "1.5px solid #e4eafc",
                  boxShadow: "0 2px 8px rgba(15,98,254,.07)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={addCategory}
                disabled={!form.name.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: form.name.trim() ? "pointer" : "not-allowed",
                  opacity: form.name.trim() ? 1 : 0.4,
                  transition: "all .15s",
                  whiteSpace: "nowrap",
                  gap: 5,
                  padding: "7px 13px",
                  fontSize: 12,
                  background: "#0F62FE",
                  color: "#fff",
                  border: "none",
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              background: "transparent",
              borderRadius: 14,
              border: "2px dashed #e4eafc",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#6b7a9a",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0F62FE";
              e.currentTarget.style.color = "#0F62FE";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e4eafc";
              e.currentTarget.style.color = "#6b7a9a";
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Add category</span>
          </button>
        )}

        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          const isActive = cat.enabled !== false;
          return (
            <div
              key={cat.id}
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: 14,
                border: "1.5px solid #e4eafc",
                boxShadow: "0 2px 8px rgba(15,98,254,.07)",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 11,
                opacity: isActive ? 1 : 0.55,
                transition: "all .15s",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  background: cat.color,
                  borderRadius: "14px 0 0 14px",
                  opacity: isActive ? 1 : 0.3,
                }}
              />
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: withAlpha(cat.color, "15"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginLeft: 4,
                }}
              >
                <Icon className="h-4 w-4" style={{ color: cat.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#181e35" }}>{cat.name}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#a8b4cc",
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {cat.description}
                </div>
              </div>
              <button
                onClick={() => toggleCategory(cat.id)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: isActive ? "#0F62FE" : "#d0daef",
                  position: "relative",
                  flexShrink: 0,
                  padding: 0,
                  transition: "background .2s",
                }}
                aria-label="Toggle category"
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: isActive ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left .2s",
                    boxShadow: "0 1px 4px rgba(0,0,0,.15)",
                  }}
                />
              </button>
              <button
                onClick={() => removeCategory(cat.id)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  background: "#f4f7ff",
                  border: "1px solid #e4eafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                aria-label="Remove category"
              >
                <X className="h-3 w-3" style={{ color: "#a8b4cc" }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
