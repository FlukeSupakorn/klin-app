import type { OnboardingState } from "@/types/onboarding";
import { getCategoryIcon } from "@/features/categories/category-appearance";
import {
  Check,
  Eye,
  FolderOpen,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";

interface CompleteStepProps {
  state: OnboardingState;
  onLaunch: () => void;
  isLaunching?: boolean;
}

export function CompleteStep({ state, onLaunch, isLaunching = false }: CompleteStepProps) {
  const activeCategories = state.categories.filter((cat) => cat.enabled !== false);
  return (
    <div style={{ display: "flex", flexDirection: "column", animation: "klin-fade-in 0.3s ease", width: "100%", maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24, textAlign: "center" }}>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <div style={{ position: "absolute", inset: -12, background: "radial-gradient(circle,rgba(15,98,254,.15) 0%,transparent 70%)", borderRadius: "50%" }} />
          <div style={{ width: 78, height: 78, borderRadius: "50%", background: "#0F62FE", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: "0 12px 30px rgba(15,98,254,.35)" }}>
            <Check className="h-9 w-9" style={{ color: "#fff" }} />
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 8px", borderRadius: 20, background: "rgba(15,98,254,.11)", marginBottom: 14 }}>
          <Rocket className="h-3.5 w-3.5" style={{ color: "#0F62FE" }} />
          <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0F62FE", textTransform: "uppercase", letterSpacing: ".1em" }}>Step 4 of 4 · Done</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.6px", color: "#181e35", marginBottom: 8 }}>You&apos;re all set!</h1>
        <p style={{ fontSize: 14, color: "#6b7a9a", lineHeight: 1.6, maxWidth: 460 }}>
          KLIN is configured and ready to start organizing your files intelligently. Here&apos;s a summary of your setup.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 13, background: "#fff", borderRadius: 18, border: "1px solid #e4eafc", boxShadow: "0 2px 8px rgba(15,98,254,.07)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(15,98,254,.11)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FolderOpen className="h-4 w-4" style={{ color: "#0F62FE" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em" }}>Base path</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#181e35", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
              {state.basePath || "~/KLIN"}
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 13, background: "#fff", borderRadius: 18, border: "1px solid #e4eafc", boxShadow: "0 2px 8px rgba(15,98,254,.07)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(139,92,246,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles className="h-4 w-4" style={{ color: "#8b5cf6" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em" }}>Categories</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#181e35", marginTop: 2 }}>{activeCategories.length} active categories</div>
          </div>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 13, background: "#fff", borderRadius: 18, border: "1px solid #e4eafc", boxShadow: "0 2px 8px rgba(15,98,254,.07)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16,185,129,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Eye className="h-4 w-4" style={{ color: "#10b981" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em" }}>Watcher folders</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#181e35", marginTop: 2 }}>
              {state.watcherFolders.length} director{state.watcherFolders.length === 1 ? "y" : "ies"} monitored
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, paddingLeft: 4 }}>Active categories</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {activeCategories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            return (
              <div key={cat.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px 6px 8px", borderRadius: 20, background: "#fff", border: "1.5px solid #e4eafc", boxShadow: "0 2px 8px rgba(15,98,254,.07)" }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: `${cat.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon className="h-3 w-3" style={{ color: cat.color }} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#181e35" }}>{cat.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onLaunch}
        disabled={isLaunching}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          fontWeight: 700,
          cursor: isLaunching ? "not-allowed" : "pointer",
          opacity: isLaunching ? 0.7 : 1,
          transition: "all .15s",
          whiteSpace: "nowrap",
          gap: 8,
          padding: "13px 24px",
          fontSize: 14,
          background: "#0F62FE",
          color: "#fff",
          border: "none",
          width: "100%",
        }}
      >
        {isLaunching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Setting up…
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4" />
            Launch KLIN
          </>
        )}
      </button>
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11.5, color: "#a8b4cc" }}>
        You can update any of these settings later from the Settings panel.
      </div>
    </div>
  );
}
