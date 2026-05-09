import { useState } from "react";
import { tauriClient } from "@/services/tauri-client";
import {
  FileText,
  FolderOpen,
  HardDrive,
  Home,
  Info,
  MapPin,
} from "lucide-react";

interface DefaultFolderStepProps {
  value: string;
  onChange: (val: string) => void;
  onNext: () => void;
}

const SUGGESTED_PATHS = [
  { label: "Home folder", path: "~/KLIN", icon: Home },
  { label: "Documents", path: "~/Documents/KLIN", icon: FileText },
  { label: "Desktop", path: "~/Desktop/KLIN", icon: MapPin },
  { label: "Custom drive", path: "/Volumes/MyDrive/KLIN", icon: HardDrive },
];

export function DefaultFolderStep({
  value,
  onChange,
}: DefaultFolderStepProps) {
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSuggestion = (path: string) => {
    onChange(path);
  };

  const handleBrowse = async () => {
    setIsBrowsing(true);
    try {
      const folder = await tauriClient.pickFolderForOrganize().catch(() => null);
      if (folder) {
        onChange(folder);
      }
    } finally {
      setIsBrowsing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", animation: "klin-fade-in 0.3s ease", width: "100%", maxWidth: 660, margin: "0 auto" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 8px", borderRadius: 20, background: "rgba(15,98,254,.11)", marginBottom: 14 }}>
        <FolderOpen className="h-3.5 w-3.5" style={{ color: "#0F62FE" }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#0F62FE", textTransform: "uppercase", letterSpacing: ".1em" }}>Step 1 of 4 · Base path</span>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.6px", color: "#181e35", marginBottom: 8 }}>Where should KLIN live?</h1>
      <p style={{ fontSize: 14, color: "#6b7a9a", lineHeight: 1.6, marginBottom: 24, maxWidth: 540 }}>
        KLIN will create organized subfolders here. Every sorted file is moved into your chosen base directory.
      </p>

      <div style={{ padding: 20, marginBottom: 18, background: "#fff", borderRadius: 18, border: "1px solid #e4eafc", boxShadow: "0 2px 8px rgba(15,98,254,.07)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Base directory path</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              background: focused ? "#fff" : "#f4f7ff",
              border: `1.5px solid ${focused ? "#0F62FE" : "#e4eafc"}`,
              borderRadius: 12,
              padding: "0 14px",
              gap: 10,
              transition: "all .2s",
              boxShadow: focused ? "0 0 0 3px rgba(15,98,254,.12)" : "none",
            }}
          >
            <FolderOpen className="h-4 w-4" style={{ color: focused ? "#0F62FE" : "#a8b4cc" }} />
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Base path for categories"
              style={{ flex: 1, border: "none", outline: "none", padding: "12px 0", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: "#181e35", background: "transparent" }}
            />
          </div>
          <button
            onClick={() => void handleBrowse()}
            disabled={isBrowsing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              fontWeight: 700,
              cursor: isBrowsing ? "not-allowed" : "pointer",
              opacity: isBrowsing ? 0.4 : 1,
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
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#a8b4cc", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, paddingLeft: 4 }}>Suggestions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {SUGGESTED_PATHS.map(({ label, path, icon: Icon }) => {
            const selected = value === path;
            return (
              <button
                key={path}
                onClick={() => handleSuggestion(path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "13px 14px",
                  borderRadius: 14,
                  background: selected ? "rgba(15,98,254,.11)" : "#fff",
                  border: `1.5px solid ${selected ? "#0F62FE" : "#e4eafc"}`,
                  boxShadow: selected ? "0 0 0 3px rgba(15,98,254,.08)" : "0 2px 8px rgba(15,98,254,.07)",
                  textAlign: "left",
                  transition: "all .15s",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: selected ? "#0F62FE" : "#f4f7ff",
                    border: selected ? "none" : "1px solid #e4eafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: selected ? "#fff" : "#0F62FE" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#181e35" }}>{label}</div>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#a8b4cc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{path}</div>
                </div>
                {selected && (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#0F62FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 11, padding: "13px 16px", borderRadius: 13, background: "rgba(15,98,254,.06)", border: "1.5px solid rgba(15,98,254,.18)" }}>
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <Info className="h-4 w-4" style={{ color: "#0F62FE" }} />
        </div>
        <div style={{ fontSize: 12.5, color: "#6b7a9a", lineHeight: 1.55 }}>
          KLIN will automatically create category subfolders inside this base path. You can change this any time from Settings.
        </div>
      </div>
    </div>
  );
}
