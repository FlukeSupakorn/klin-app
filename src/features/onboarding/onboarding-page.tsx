import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { StepProgress } from "./step-progress";
import { WelcomeStep } from "./step/welcome-step";
import { DefaultFolderStep } from "./step/default-folder-step";
import { CategoriesStep } from "./step/categories-step";
import { WatcherStep } from "./step/watcher-step";
import { CompleteStep } from "./step/complete-step";
import type { OnboardingState, OnboardingStep } from "./types";
import { DEFAULT_CATEGORIES } from "./types";
import { categoryManagementService } from "@/services/category-management-service";
import { tauriClient } from "@/services/tauri-client";
import { markOnboardingCompletedInSession } from "./onboarding-guard";

const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "base-path",
  "categories",
  "watcher",
  "complete",
];
/*
  TODO: Plan นะ @FlukeSupakorn
  Implement full logic onboarding with current api after user open app and enter onboarding screen use default path to download of each platform 
  - C:\Users\Username\Downloads
  - /Users/sarun/Downloads 
  then sent to /api/settings/default-base-path immediately so user will not wait and use store to check loading process that wait from api.

  Next base path step(default folder), it will set to previosu download path that we init, With suggesttion logic to Documents and desktop foler, Implement browse folder that already in project.

  Next categories after set base path you will get updated_categories list from api then show in ui, remove DEFAULT_CATEGORIES in frontend and use only from api, then user can edit name and description of category but no icon (if want we will update schema).
  it should require user to have at least 1 category to next step. 

  Next watcher folder check data model and implement logic in fronend, path, recursive or not, add and remove watcher folder

  After click finish it will send changes like categories and watcher folder from store to api

*/

export function OnboardingPage() {
  const navigate = useNavigate();

  const [state, setState] = useState<OnboardingState>({
    step: "welcome",
    basePath: "",
    categories: DEFAULT_CATEGORIES,
    watcherFolders: [],
  });

  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const formatError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    if (error && typeof error === "object") {
      const maybeMessage = Reflect.get(error, "message");
      if (typeof maybeMessage === "string" && maybeMessage.trim()) {
        return maybeMessage;
      }

      try {
        return JSON.stringify(error);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }, []);

  const waitForLlamaHealth = useCallback(async (port: number, timeoutMs: number) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) return true;
      } catch {
        // retry until timeout
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
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
    setLaunchError(null);
    try {
      try {
        await tauriClient.ensureLlamaServer("embed");
      } catch (error) {
        throw new Error(
          `Failed to start embedding server: ${formatError(error, "unknown error")}`,
        );
      }

      const embedReady = await waitForLlamaHealth(8081, 15000);
      if (!embedReady) {
        throw new Error("Embedding model is not ready. Start llama-server or verify model paths.");
      }

      try {
        await categoryManagementService.saveDefaultFolder(state.basePath);
      } catch (error) {
        throw new Error(
          `Failed to save base path: ${formatError(error, "worker API unavailable")}`,
        );
      }

      for (const cat of state.categories) {
        try {
          await categoryManagementService.addCategoryToWorker({
            name: cat.name,
            description: cat.description,
            folderPath: `${state.basePath}/${cat.name}`,
            color: cat.color,
            icon: cat.icon,
            enabled: true,
            aiLearned: false,
            isAutoDescription: false,
          });
        } catch (error) {
          throw new Error(
            `Failed to create category "${cat.name}": ${formatError(error, "unknown error")}`,
          );
        }
      }

      if (state.watcherFolders.length > 0) {
        try {
          await tauriClient.saveAutomationConfig({
            auto_organize_enabled: false,
            watched_folders: state.watcherFolders.map((f) => f.path),
            scan_interval_seconds: 60,
          });
        } catch (error) {
          throw new Error(
            `Failed to save watcher configuration: ${formatError(error, "unknown error")}`,
          );
        }
      }

      markOnboardingCompletedInSession();
      navigate("/");
    } catch (err) {
      const message = formatError(err, "Failed to finish onboarding.");
      console.error("[onboarding] launch failed:", err);
      setLaunchError(message);
    } finally {
      setIsLaunching(false);
    }
  };

  const showProgress = state.step !== "welcome" && state.step !== "complete";

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        {/* Step progress — hidden on welcome and complete */}
        {showProgress && (
          <div className="mb-8 w-full px-1 md:px-3">
            <StepProgress currentStep={state.step} />
          </div>
        )}

        {/* Step content with slide transition */}
        <div
          className={cn(
            "flex w-full justify-center transition-all",
            animating && direction === "forward"
              ? "opacity-0 translate-x-8"
              : animating && direction === "back"
              ? "opacity-0 -translate-x-8"
              : "opacity-100 translate-x-0"
          )}
          style={{ transitionDuration: "220ms" }}
        >
          {state.step === "welcome" && <WelcomeStep onNext={goNext} />}

          {state.step === "base-path" && (
            <DefaultFolderStep
              value={state.basePath}
              onChange={(val) =>
                setState((prev) => ({ ...prev, basePath: val }))
              }
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {state.step === "categories" && (
            <CategoriesStep
              categories={state.categories}
              onCategoriesChange={(cats) =>
                setState((prev) => ({ ...prev, categories: cats }))
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
              onFoldersChange={(folders) =>
                setState((prev) => ({ ...prev, watcherFolders: folders }))
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
              errorMessage={launchError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
