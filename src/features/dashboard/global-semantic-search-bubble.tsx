import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Brain, Sparkles, X } from "lucide-react";
import { useSemanticSearchStore } from "@/stores/use-semantic-search-store";

/**
 * Floating pill that lets the user step away from the search dropdown
 * without losing the in-flight request. Clicking it returns them to the
 * dashboard with the results re-opened. Mirrors the pattern used by
 * GlobalOrganizeResumeBubble.
 */
export function GlobalSemanticSearchBubble() {
  const navigate = useNavigate();
  const location = useLocation();

  const loading = useSemanticSearchStore((s) => s.loading);
  const startedAt = useSemanticSearchStore((s) => s.startedAt);
  const results = useSemanticSearchStore((s) => s.results);
  const error = useSemanticSearchStore((s) => s.error);
  const isDropdownOpen = useSemanticSearchStore((s) => s.isDropdownOpen);
  const acknowledged = useSemanticSearchStore((s) => s.acknowledged);
  const query = useSemanticSearchStore((s) => s.query);
  const cancel = useSemanticSearchStore((s) => s.cancel);
  const reset = useSemanticSearchStore((s) => s.reset);
  const openDropdown = useSemanticSearchStore((s) => s.openDropdown);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [loading]);

  // Hide bubble when the dropdown is already showing the same state.
  const onDashboard = location.pathname === "/" || location.pathname === "";
  const hasUnseen = !acknowledged && (results.length > 0 || error !== null);
  const visible = (loading || hasUnseen) && !(isDropdownOpen && onDashboard);

  if (!visible) return null;

  const elapsedSec = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;

  const open = () => {
    if (!onDashboard) navigate("/");
    openDropdown();
  };

  const dismiss = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (loading) {
      cancel();
    } else {
      reset();
    }
  };

  let label: string;
  let detail: string;
  let Icon = Brain;
  if (loading) {
    label = "Semantic search running";
    detail = `${elapsedSec.toFixed(1)}s · "${truncate(query, 28)}"`;
  } else if (error) {
    label = "Search failed";
    detail = truncate(error, 40);
    Icon = X;
  } else {
    label = `${results.length} result${results.length === 1 ? "" : "s"} ready`;
    detail = `for "${truncate(query, 28)}"`;
    Icon = Sparkles;
  }

  return (
    <button
      type="button"
      onClick={open}
      className="klin-toast-in fixed bottom-6 left-6 z-50 flex max-w-[320px] items-center gap-2.5 rounded-full border border-border bg-card py-2 pl-2 pr-3 text-left shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ boxShadow: "0 12px 36px var(--primary-border)" }}
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        {loading && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
              opacity: 0.25,
              animation: "klin-logo-breathe 1.6s ease-in-out infinite",
            }}
          />
        )}
        <span
          className="relative flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: error ? "var(--destructive)" : "var(--primary)",
            animation: loading ? "klin-logo-breathe 1.6s ease-in-out infinite" : undefined,
          }}
        >
          <Icon className="h-3.5 w-3.5 text-white" />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-bold text-foreground">{label}</span>
        <span
          className="block truncate text-[10px] text-muted-foreground"
          style={{ fontFamily: "'JetBrains Mono',monospace" }}
        >
          {detail}
        </span>
      </span>

      <span
        role="button"
        tabIndex={-1}
        aria-label={loading ? "Cancel search" : "Dismiss"}
        onClick={dismiss}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}
