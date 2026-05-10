import { useCallback, useEffect, useRef, useState } from "react";
import klinLogo from "@/assets/klin-logo.svg";
import type { SubdirEntry } from "@/types/ipc";
import { tauriClient } from "@/services/tauri-client";
import { FolderTreeNode } from "./folder-tree-node";

export interface CachedTreeData {
  childrenMap: Map<string, SubdirEntry[]>;
  expandedPaths: Set<string>;
  level1Loaded: boolean;
  allPathsLoaded: boolean;
}

interface FolderTreeViewProps {
  rootPath: string;
  deselectedPaths: Set<string>;
  focusPath?: string | null;
  onToggle: (path: string, checked: boolean) => void;
  onToggleMany: (paths: string[], checked: boolean) => void;
  onAllPathsLoaded: (rootPath: string, allPaths: string[]) => void;
  getCache?: (rootPath: string) => CachedTreeData | undefined;
  setCache?: (rootPath: string, data: CachedTreeData) => void;
}

type ChildrenMap = Map<string, SubdirEntry[]>;

function normalizePath(path: string): string {
  return path.replace(/[\\/]+$/, "").replace(/\\/g, "/").toLowerCase();
}

export function FolderTreeView({
  rootPath,
  deselectedPaths,
  focusPath = null,
  onToggle,
  onToggleMany,
  onAllPathsLoaded,
  getCache,
  setCache,
}: FolderTreeViewProps) {
  const cached = getCache?.(rootPath);
  const [childrenMap, setChildrenMap] = useState<ChildrenMap>(
    () => cached?.childrenMap ?? new Map(),
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => cached?.expandedPaths ?? new Set(),
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(!cached?.level1Loaded);
  const [isLoadingAllPaths, setIsLoadingAllPaths] = useState(
    Boolean(cached?.level1Loaded) && !cached?.allPathsLoaded,
  );
  const lastFocusHandledRef = useRef<string | null>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const allPathsLoadedFiredRef = useRef<Set<string>>(new Set());

  // Persist current state to cache whenever it changes.
  // Guard against transient stale-state writes during a root switch by only
  // writing when the in-memory state actually belongs to the current root
  // (i.e., either we're still initializing for it, or its level-1 entry exists).
  useEffect(() => {
    if (!setCache) return;
    if (!isInitializing && !childrenMap.has(rootPath)) return;
    setCache(rootPath, {
      childrenMap,
      expandedPaths,
      level1Loaded: !isInitializing,
      allPathsLoaded: !isLoadingAllPaths,
    });
  }, [rootPath, childrenMap, expandedPaths, isInitializing, isLoadingAllPaths, setCache]);

  useEffect(() => {
    lastFocusHandledRef.current = null;
  }, [rootPath]);

  useEffect(() => {
    let cancelled = false;
    const cachedNow = getCache?.(rootPath);

    // Hydrate from cache on root switch
    if (cachedNow?.level1Loaded) {
      setChildrenMap(cachedNow.childrenMap);
      setExpandedPaths(cachedNow.expandedPaths);
      setIsInitializing(false);
      const needsAllPaths = !cachedNow.allPathsLoaded;
      setIsLoadingAllPaths(needsAllPaths);
      if (needsAllPaths) {
        tauriClient
          .listAllSubdirectories(rootPath)
          .then((allPaths) => {
            if (cancelled) return;
            if (!allPathsLoadedFiredRef.current.has(rootPath)) {
              allPathsLoadedFiredRef.current.add(rootPath);
              onAllPathsLoaded(rootPath, allPaths);
            }
            setIsLoadingAllPaths(false);
          })
          .catch(() => {
            if (!cancelled) setIsLoadingAllPaths(false);
          });
      }
      return () => {
        cancelled = true;
      };
    }

    const initialize = async () => {
      setIsInitializing(true);
      setIsLoadingAllPaths(true);
      setChildrenMap(new Map());
      setExpandedPaths(new Set());

      try {
        const level1 = await tauriClient.listSubdirectories(rootPath);
        if (cancelled) return;

        const newMap = new Map<string, SubdirEntry[]>([[rootPath, level1]]);
        const autoExpanded = new Set<string>(level1.map((e) => e.path));

        const level2Results = await Promise.all(
          level1
            .filter((e) => e.has_children)
            .map(async (e) => {
              const children = await tauriClient.listSubdirectories(e.path);
              return { parentPath: e.path, children };
            }),
        );
        if (cancelled) return;

        for (const { parentPath, children } of level2Results) {
          newMap.set(parentPath, children);
        }

        setChildrenMap(newMap);
        setExpandedPaths(autoExpanded);
        setIsInitializing(false);

        tauriClient
          .listAllSubdirectories(rootPath)
          .then((allPaths) => {
            if (cancelled) return;
            setTimeout(() => {
              if (cancelled) return;
              if (!allPathsLoadedFiredRef.current.has(rootPath)) {
                allPathsLoadedFiredRef.current.add(rootPath);
                onAllPathsLoaded(rootPath, allPaths);
              }
              setIsLoadingAllPaths(false);
            }, 0);
          })
          .catch(() => {
            if (!cancelled) setIsLoadingAllPaths(false);
          });
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  useEffect(() => {
    if (!focusPath || isInitializing) return;

    const normalizedRoot = normalizePath(rootPath);
    const normalizedFocus = normalizePath(focusPath);
    const focusKey = `${normalizedRoot}::${normalizedFocus}`;
    if (lastFocusHandledRef.current === focusKey) return;
    lastFocusHandledRef.current = focusKey;

    if (!normalizedFocus.startsWith(`${normalizedRoot}/`)) return;

    let cancelled = false;

    const expandToPath = async () => {
      const relative = normalizedFocus.slice(normalizedRoot.length + 1);
      const segments = relative.split("/").filter(Boolean);
      if (!segments.length) return;

      let parentPath = rootPath;

      for (const segment of segments) {
        let children = childrenMap.get(parentPath);
        if (!children) {
          const loaded = await tauriClient.listSubdirectories(parentPath);
          if (cancelled) return;
          setChildrenMap((prev) => new Map([...prev, [parentPath, loaded]]));
          children = loaded;
        }

        const match = (children ?? []).find((entry) => entry.name.toLowerCase() === segment.toLowerCase());
        if (!match) return;

        setExpandedPaths((prev) => new Set([...prev, match.path]));
        parentPath = match.path;
      }

      const scrollTarget = () => {
        if (!treeContainerRef.current) return false;
        const normalized = normalizePath(focusPath);
        const nodes = treeContainerRef.current.querySelectorAll<HTMLElement>("[data-path-key]");
        const target = Array.from(nodes).find((node) => node.dataset.pathKey === normalized);
        if (!target) return false;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      };

      let attempts = 0;
      const maxAttempts = 10;
      const tryScroll = () => {
        if (cancelled) return;
        if (scrollTarget() || attempts >= maxAttempts) return;
        attempts += 1;
        setTimeout(tryScroll, 80);
      };

      setTimeout(tryScroll, 0);
    };

    void expandToPath();

    return () => {
      cancelled = true;
    };
  }, [focusPath, rootPath, isInitializing]);

  const handleToggleExpand = useCallback(
    async (path: string) => {
      const isCurrentlyExpanded = expandedPaths.has(path);

      if (isCurrentlyExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        return;
      }

      setExpandedPaths((prev) => new Set([...prev, path]));

      if (!childrenMap.has(path)) {
        setLoadingPaths((prev) => new Set([...prev, path]));
        try {
          const loaded = await tauriClient.listSubdirectories(path);
          setChildrenMap((prev) => new Map([...prev, [path, loaded]]));
        } finally {
          setLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [expandedPaths, childrenMap],
  );

  const handleToggleSubtree = useCallback(async (path: string, checked: boolean) => {
    const descendants = await tauriClient.listAllSubdirectories(path).catch(() => [] as string[]);
    onToggleMany([path, ...descendants], checked);
  }, [onToggleMany]);

  const renderNode = (entry: SubdirEntry, level: number): React.ReactNode => {
    const isExpanded = expandedPaths.has(entry.path);
    const isLoading = loadingPaths.has(entry.path);
    const isChecked = !deselectedPaths.has(entry.path);
    const nodeChildren = childrenMap.get(entry.path) ?? [];

    return (
      <FolderTreeNode
        key={entry.path}
        name={entry.name}
        path={entry.path}
        pathKey={normalizePath(entry.path)}
        indentLevel={level}
        checked={isChecked}
        onToggle={onToggle}
        onToggleSubtree={handleToggleSubtree}
        hasChildren={entry.has_children}
        isExpanded={isExpanded}
        onToggleExpand={handleToggleExpand}
        isLoading={isLoading}
        highlighted={focusPath ? normalizePath(entry.path) === normalizePath(focusPath) : false}
      >
        {isExpanded && nodeChildren.map((child) => renderNode(child, level + 1))}
      </FolderTreeNode>
    );
  };

  if (isInitializing || isLoadingAllPaths) {
    const phaseTitle = isInitializing ? "Scanning subfolders…" : "Indexing all subfolders…";
    const phaseHint = isInitializing
      ? "Reading folder structure. This may take a moment for large folders."
      : "Counting every nested folder so KLIN knows what to import. Hang tight — this is the slow part for big folders.";
    return (
      <div
        className="klin-fade-in"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        <img
          src={klinLogo}
          alt="Klin"
          draggable={false}
          className="klin-logo-breathe"
          style={{ width: 56, height: 56, userSelect: "none" }}
        />
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--foreground)",
              letterSpacing: "-0.2px",
              marginBottom: 4,
            }}
          >
            {phaseTitle}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              lineHeight: 1.5,
              maxWidth: 340,
            }}
          >
            {phaseHint}
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 999,
            background: "var(--primary-soft)",
            border: "1px solid var(--primary-border)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              border: "1.5px solid var(--primary)",
              borderTopColor: "transparent",
              animation: "spin .9s linear infinite",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              color: "var(--primary)",
              letterSpacing: ".12em",
              textTransform: "uppercase",
            }}
          >
            {isInitializing ? "Loading" : "Indexing"}
          </span>
        </div>
      </div>
    );
  }

  const level1 = childrenMap.get(rootPath) ?? [];

  if (level1.length === 0) {
    return (
      <p style={{ padding: "24px 16px", fontSize: 13, color: "var(--muted-foreground)" }}>
        No subfolders found in this directory.
      </p>
    );
  }

  return (
    <div ref={treeContainerRef} style={{ position: "relative", paddingTop: 4, paddingBottom: 4 }}>
      {level1.map((entry) => renderNode(entry, 0))}
    </div>
  );
}
