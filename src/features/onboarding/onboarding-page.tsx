import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { CloseAppController } from "@/components/dialogs/close-app-controller";
import { StepProgress } from "./step-progress";
import { DefaultFolderStep } from "./step/default-folder-step";
import { CategoriesStep } from "./step/categories-step";
import { WatcherStep } from "./step/watcher-step";
import { CompleteStep } from "./step/complete-step";
import type { OnboardingState, OnboardingStep } from "@/types/onboarding";
import { DEFAULT_CATEGORIES } from "@/constants/onboarding";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { markOnboardingCompletedInSession } from "./onboarding-guard";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { joinFolderPath } from "@/lib/path-utils";
import type { ManagedCategory } from "@/types/domain";

const STEP_ORDER: OnboardingStep[] = [
  "base-path",
  "categories",
  "watcher",
  "complete",
];

export function OnboardingPage() {
  const navigate = useNavigate();

  const [state, setState] = useState<OnboardingState>({
    step: "base-path",
    basePath: "",
    categories: [],
    watcherFolders: [],
  });

  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrateOnboardingDefaults = async () => {
      const downloadsFolder = await tauriClient.getDownloadsFolder().catch(() => "");

      if (cancelled) {
        return;
      }

      setState((prev) => {
        const nextBasePath = prev.basePath || downloadsFolder;
        const hasDownloadsWatcher = prev.watcherFolders.some((folder) => folder.path === downloadsFolder);
        const nextWatchers = downloadsFolder && !hasDownloadsWatcher
          ? [{ id: `watcher-${Date.now()}`, path: downloadsFolder }, ...prev.watcherFolders]
          : prev.watcherFolders;

        return {
          ...prev,
          basePath: nextBasePath,
          categories: DEFAULT_CATEGORIES,
          watcherFolders: nextWatchers,
        };
      });
    };

    void hydrateOnboardingDefaults();

    return () => {
      cancelled = true;
    };
  }, []);

  const navigate_ = useCallback(
    (target: OnboardingStep, dir: "forward" | "back" = "forward") => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setState((prev) => ({ ...prev, step: target }));
        setAnimating(false);
      }, 220);
    },
    [animating]
  );

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(state.step);
    if (idx < STEP_ORDER.length - 1) navigate_(STEP_ORDER[idx + 1], "forward");
  }, [state.step, navigate_]);

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(state.step);
    if (idx > 0) navigate_(STEP_ORDER[idx - 1], "back");
  }, [state.step, navigate_]);

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      await categoryManagementService.saveDefaultFolder(state.basePath);

      await categoryManagementService.refreshCategoriesFromWorker();
      const backendCategories = useCategoryManagementStore.getState().categories;
      const backendByName = new Map(
        backendCategories.map((category: ManagedCategory) => [category.name.trim().toLowerCase(), category]),
      );
      const localByName = new Map(
        state.categories.map((category) => [category.name.trim().toLowerCase(), category]),
      );

      for (const backendCategory of backendCategories) {
        if (!localByName.has(backendCategory.name.trim().toLowerCase())) {
          await categoryManagementService.deleteCategoryInWorker(backendCategory.id).catch(() => undefined);
        }
      }

      for (const localCategory of state.categories) {
        const normalizedName = localCategory.name.trim();
        const normalizedDescription = localCategory.description.trim();
        if (!normalizedName || !normalizedDescription) {
          continue;
        }

        const folderPath = joinFolderPath(state.basePath, normalizedName);
        const existing = backendByName.get(normalizedName.toLowerCase());
        const desiredEnabled = localCategory.enabled !== false;

        if (!existing) {
          await categoryManagementService.addCategoryToWorker({
            name: normalizedName,
            description: normalizedDescription,
            folderPath,
            color: localCategory.color,
            icon: localCategory.icon,
            enabled: desiredEnabled,
            aiLearned: false,
            isAutoDescription: false,
          }).catch(() => undefined);
          continue;
        }

        const updates: Partial<ManagedCategory> = {};
        if (existing.name !== normalizedName) updates.name = normalizedName;
        if (existing.description !== normalizedDescription) updates.description = normalizedDescription;
        if (existing.color !== localCategory.color) updates.color = localCategory.color;
        if (existing.icon !== localCategory.icon) updates.icon = localCategory.icon;
        if (existing.folderPath !== folderPath) updates.folderPath = folderPath;
        if (existing.enabled !== desiredEnabled) updates.enabled = desiredEnabled;

        if (Object.keys(updates).length > 0) {
          await categoryManagementService.updateCategoryInWorker(existing.id, updates).catch(() => undefined);
        }
      }

      if (state.watcherFolders.length > 0) {
        await tauriClient
          .saveAutomationConfig({
            auto_organize_enabled: false,
            watched_folders: state.watcherFolders.map((f) => f.path),
            scan_interval_seconds: 60,
          })
          .catch(() => undefined);
      }
    } finally {
      markOnboardingCompletedInSession();
      navigate("/");
      setIsLaunching(false);
    }
  };

  const showProgress = state.step !== "complete";
  const stepIndex = STEP_ORDER.indexOf(state.step);
  const canContinue = (() => {
    if (state.step === "base-path") return Boolean(state.basePath.trim());
    if (state.step === "watcher") return state.watcherFolders.length > 0;
    return true;
  })();

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#edf1ff", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(15,98,254,.08) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -200,
          left: -200,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(139,92,246,.06) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {showProgress && (
        <div style={{ maxWidth: 920, margin: "0 auto", width: "100%" }}>
          <StepProgress currentStep={state.step} />
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "10px 32px 30px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            width: "100%",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              opacity: animating ? 0 : 1,
              transform: animating
                ? direction === "forward"
                  ? "translateX(20px)"
                  : "translateX(-20px)"
                : "translateX(0)",
              transition: "opacity 220ms ease, transform 220ms ease",
            }}
          >
            {state.step === "base-path" && (
              <DefaultFolderStep
                value={state.basePath}
                onChange={(val) =>
                  setState((prev) => ({ ...prev, basePath: val }))
                }
                onNext={goNext}
              />
            )}
            {state.step === "categories" && (
              <CategoriesStep
                categories={state.categories}
                onCategoriesChange={(nextCategories) =>
                  setState((prev) => ({ ...prev, categories: nextCategories }))
                }
                onNext={goNext}
                onBack={goBack}
                onSkip={goNext}
              />
            )}
            {state.step === "watcher" && (
              <WatcherStep
                basePath={state.basePath}
                folders={state.watcherFolders}
                onFoldersChange={(nextFolders) =>
                  setState((prev) => ({ ...prev, watcherFolders: nextFolders }))
                }
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {state.step === "complete" && (
              <CompleteStep
                state={state}
                onLaunch={handleLaunch}
                isLaunching={isLaunching}
              />
            )}
          </div>
        </div>
      </div>

      {showProgress && (
        <div
          style={{
            padding: "14px 32px 18px",
            borderTop: "1px solid #e4eafc",
            background: "rgba(255,255,255,.7)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            position: "sticky",
            bottom: 0,
            zIndex: 2,
          }}
        >
          <div style={{ maxWidth: 920, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11.5, color: "#a8b4cc" }}>Step {stepIndex + 1} of 4</div>
            <div style={{ flex: 1 }} />
            {stepIndex > 0 && (
              <button
                onClick={goBack}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all .15s",
                  whiteSpace: "nowrap",
                  gap: 6,
                  padding: "10px 18px",
                  fontSize: 13,
                  background: "#fff",
                  color: "#6b7a9a",
                  border: "1.5px solid #e4eafc",
                  boxShadow: "0 2px 8px rgba(15,98,254,.07)",
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!canContinue}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                fontWeight: 700,
                cursor: canContinue ? "pointer" : "not-allowed",
                opacity: canContinue ? 1 : 0.4,
                transition: "all .15s",
                whiteSpace: "nowrap",
                gap: 6,
                padding: "10px 18px",
                fontSize: 13,
                background: "#0F62FE",
                color: "#fff",
                border: "none",
              }}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <CloseAppController mode="quit-immediately" />
    </div>
  );
}
