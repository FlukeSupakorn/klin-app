import { useState } from "react";
import { tauriClient } from "@/services/tauri-client";
import type { WatcherFolder } from "@/types/onboarding";
import {
  AlertCircle,
  Eye,
  FolderInput,
  FolderOpen,
  Info,
  Plus,
  Trash2,
} from "lucide-react";

interface WatcherStepProps {
  basePath: string;
  folders: WatcherFolder[];
  onFoldersChange: (folders: WatcherFolder[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WatcherStep({
  basePath,
  folders,
  onFoldersChange,
}: WatcherStepProps) {
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);

  const addFolder = (pathOverride?: string) => {
    const trimmed = (pathOverride ?? newPath).trim();
    if (!trimmed) {
      setError("Enter a directory path to watch.");
      return;
    }
    if (folders.find((f) => f.path === trimmed)) {
      setError("This path is already being watched.");
      return;
    }
    setError("");
    onFoldersChange([
      ...folders,
      { id: `watcher-${Date.now()}`, path: trimmed },
    ]);
    setNewPath("");
  };

  const handleBrowse = async () => {
    const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
    if (folder) {
      const trimmed = folder.trim();
      if (trimmed && !folders.find((f) => f.path === trimmed)) {
        setError("");
        onFoldersChange([
          ...folders,
          { id: `watcher-${Date.now()}`, path: trimmed },
        ]);
      }
    }
  };

  const removeFolder = (id: string) => {
    onFoldersChange(folders.filter((f) => f.id !== id));
  };

  const Tag = ({ label, color, size = "sm" }: { label: string; color: "green" | "gray"; size?: "xs" | "sm" }) => {
    const config = {
      green: { bg: "rgba(16,185,129,.1)", fg: "#10b981" },
      gray: { bg: "#eef0f8", fg: "#6b7a9a" },
    }[color];
    return (
      <span
        style={{
          fontSize: size === "xs" ? 9.5 : 10.5,
          fontWeight: 800,
          padding: size === "xs" ? "2px 7px" : "3px 9px",
          borderRadius: 10,
          background: config.bg,
          color: config.fg,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    );
  };


  return (
    <div style={{ display: "flex", flexDirection: "column", animation: "klin-fade-in 0.3s ease", width: "100%", maxWidth: 660, margin: "0 auto" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 8px", borderRadius: 20, background: "rgba(15,98,254,.11)", marginBottom: 14 }}>
        <Eye className="h-3.5 w-3.5" style={{ color: "#0F62FE" }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0F62FE", textTransform: "uppercase", letterSpacing: ".1em" }}>Step 3 of 4 · Watcher folders</span>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.6px", color: "#181e35", marginBottom: 8 }}>Choose folders to watch</h1>
      <p style={{ fontSize: 14, color: "#6b7a9a", lineHeight: 1.6, marginBottom: 22, maxWidth: 540 }}>
        KLIN monitors these directories in real time. Any new file dropped in is automatically sorted into your base path.
      </p>

      <div style={{ padding: 18, marginBottom: 14, background: "#fff", borderRadius: 18, border: "1px solid #e4eafc", boxShadow: "0 2px 8px rgba(15,98,254,.07)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Add directory to watch</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              background: focused ? "#fff" : "#f4f7ff",
              border: `1.5px solid ${focused ? "#0F62FE" : error ? "#ef4444" : "#e4eafc"}`,
              borderRadius: 12,
              padding: "0 14px",
              gap: 10,
              transition: "all .2s",
              boxShadow: focused ? "0 0 0 3px rgba(15,98,254,.12)" : "none",
            }}
          >
            <FolderOpen className="h-4 w-4" style={{ color: focused ? "#0F62FE" : "#a8b4cc" }} />
            <input
              value={newPath}
              onChange={(e) => {
                setNewPath(e.target.value);
                setError("");
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === "Enter" && addFolder()}
              placeholder="Path to a directory"
              spellCheck={false}
              style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#181e35", background: "transparent" }}
            />
          </div>
          <button
            onClick={handleBrowse}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .15s",
              whiteSpace: "nowrap",
              gap: 7,
              padding: "10px 18px",
              fontSize: 13,
              background: "#fff",
              color: "#6b7a9a",
              border: "1.5px solid #e4eafc",
              boxShadow: "0 2px 8px rgba(15,98,254,.07)",
            }}
          >
            <FolderOpen className="h-4 w-4" />
            Browse
          </button>
          <button
            onClick={() => addFolder()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .15s",
              whiteSpace: "nowrap",
              gap: 7,
              padding: "10px 18px",
              fontSize: 13,
              background: "#0F62FE",
              color: "#fff",
              border: "none",
            }}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: "#ef4444", fontSize: 11.5 }}>
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em" }}>Watched folders</div>
          <Tag label={`${folders.length} active`} color="green" />
        </div>
        {folders.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "32px 16px",
              background: "transparent",
              border: "2px dashed #e4eafc",
              borderRadius: 14,
              textAlign: "center",
            }}
          >
            <FolderInput className="h-7 w-7" style={{ color: "#c4cee0" }} />
            <p style={{ fontSize: 12, color: "#a8b4cc", margin: 0 }}>
              No watch folders yet. Add one above or skip this step.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {folders.map((folder) => (
              <div
                key={folder.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "12px 14px",
                  background: "#fff",
                  border: "1.5px solid #e4eafc",
                  borderRadius: 13,
                  boxShadow: "0 2px 8px rgba(15,98,254,.07)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#10b981" }} />
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16,185,129,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 4 }}>
                  <div style={{ position: "relative", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Eye className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
                    <div style={{ position: "absolute", inset: -3, borderRadius: "50%", animation: "klin-pulse-dot 2s infinite" }} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "#181e35", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.path}</div>
                  <div style={{ fontSize: 10.5, color: "#a8b4cc", marginTop: 2 }}>Real-time monitoring active</div>
                </div>
                <Tag label="Watching" color="green" size="xs" />
                <button
                  onClick={() => removeFolder(folder.id)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: "rgba(239,68,68,.08)",
                    border: "1px solid rgba(239,68,68,.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Trash2 className="h-3 w-3" style={{ color: "#ef4444" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px", background: "#f4f7ff", borderRadius: 18, border: "1px solid #e4eafc", boxShadow: "0 2px 8px rgba(15,98,254,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Info className="h-3.5 w-3.5" style={{ color: "#0F62FE" }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#6b7a9a", textTransform: "uppercase", letterSpacing: ".08em" }}>Output destination</span>
        </div>
        <div style={{ fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", color: "#6b7a9a", lineHeight: 1.6 }}>
          <span>{basePath || "~/KLIN"}/</span>
          <span style={{ background: "rgba(15,98,254,.11)", color: "#0F62FE", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>[category]</span>
          <span>/</span>
          <span style={{ background: "rgba(15,98,254,.11)", color: "#0F62FE", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>[year-month]</span>
          <span>/</span>
        </div>
      </div>
    </div>
  );
}
