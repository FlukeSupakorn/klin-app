import { useState } from "react";
import { Check, ChevronDown, Folder, FolderOpen } from "lucide-react";

interface FolderTreeNodeProps {
  name: string;
  path: string;
  indentLevel: number;
  checked: boolean;
  onToggle: (path: string, checked: boolean) => void;
  onToggleSubtree?: (path: string, checked: boolean) => void;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: (path: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  existingCategoryName?: string;
  highlighted?: boolean;
  pathKey?: string;
  children?: React.ReactNode;
}

const TX3 = "#a8b4cc";

export function FolderTreeNode({
  name,
  path,
  indentLevel,
  checked,
  onToggle,
  onToggleSubtree,
  hasChildren,
  isExpanded,
  onToggleExpand,
  isLoading = false,
  disabled = false,
  existingCategoryName,
  highlighted = false,
  pathKey,
  children,
}: FolderTreeNodeProps) {
  const [hover, setHover] = useState(false);
  const filled = checked && !disabled;
  const indentPx = 14 + indentLevel * 22;

  const handleCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const nextChecked = !checked;
    if (e.shiftKey && onToggleSubtree) {
      onToggleSubtree(path, nextChecked);
      return;
    }
    onToggle(path, nextChecked);
  };

  return (
    <div>
      <div
        data-path-key={pathKey}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "6px 10px 6px 0",
          paddingLeft: indentPx,
          borderRadius: 10,
          background: highlighted
            ? "var(--primary-soft)"
            : hover
              ? "var(--muted)"
              : "transparent",
          boxShadow: highlighted ? "inset 0 0 0 1px var(--primary-border)" : "none",
          opacity: disabled ? 0.7 : 1,
          transition: "background .1s",
          position: "relative",
        }}
      >
        {/* depth guide line */}
        {indentLevel > 0 && (
          <div
            style={{
              position: "absolute",
              left: 14 + (indentLevel - 1) * 22 + 9,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--border)",
            }}
          />
        )}

        {/* expand caret */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren && !isLoading) onToggleExpand(path);
          }}
          disabled={!hasChildren || isLoading}
          style={{
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            opacity: hasChildren || isLoading ? 1 : 0,
            color: "var(--muted-foreground)",
            transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform .15s",
            flexShrink: 0,
            cursor: hasChildren && !isLoading ? "pointer" : "default",
            padding: 0,
          }}
        >
          {isLoading ? (
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                border: "1.5px solid var(--primary)",
                borderTopColor: "transparent",
                animation: "spin .9s linear infinite",
                display: "inline-block",
              }}
            />
          ) : (
            <ChevronDown size={12} color="var(--muted-foreground)" strokeWidth={2.2} />
          )}
        </button>

        {/* checkbox */}
        <button
          type="button"
          onClick={handleCheckClick}
          disabled={disabled}
          title={
            hasChildren
              ? "Click: this folder only | Shift+Click: this folder and all subfolders"
              : undefined
          }
          style={{
            width: 16,
            height: 16,
            borderRadius: 5,
            background: filled ? "var(--primary)" : "var(--card)",
            border: `2px solid ${filled ? "var(--primary)" : "#c1cdee"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            padding: 0,
            transition: "all .12s",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {filled && <Check size={10} color="#fff" strokeWidth={3.2} />}
        </button>

        {/* folder icon */}
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: filled ? "var(--primary-soft)" : "var(--muted)",
            border: `1px solid ${filled ? "var(--primary-border)" : "var(--border)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all .12s",
          }}
        >
          {isExpanded && hasChildren ? (
            <FolderOpen
              size={12}
              color={filled ? "var(--primary)" : "var(--muted-foreground)"}
            />
          ) : (
            <Folder
              size={12}
              color={filled ? "var(--primary)" : "var(--muted-foreground)"}
            />
          )}
        </div>

        {/* name */}
        <span
          onClick={() => {
            if (hasChildren && !isLoading) onToggleExpand(path);
          }}
          style={{
            fontSize: 13,
            fontWeight: filled ? 700 : 500,
            color: disabled
              ? "var(--muted-foreground)"
              : filled
                ? "var(--foreground)"
                : "var(--muted-foreground)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            cursor: hasChildren && !isLoading ? "pointer" : "default",
            userSelect: "none",
          }}
        >
          {name}
        </span>

        {/* "Created" badge for already-existing categories */}
        {disabled && (
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              background: "rgba(245,158,11,.12)",
              color: "#a85d00",
            }}
          >
            Created{existingCategoryName ? `: ${existingCategoryName}` : ""}
          </span>
        )}

        {/* expand caret marker for non-children spacer (badge for child count not available — leave compact) */}
        {hasChildren && !disabled && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: TX3,
              fontFamily: "var(--font-mono)",
              padding: "2px 7px",
              borderRadius: 7,
              background: "var(--muted)",
              border: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            {isExpanded ? "open" : "•••"}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}
