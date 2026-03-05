import { ScoringStrategyFactory } from "@/lib/ai-scoring-service";
import { RuleEngine } from "@/services/rule-engine";
import { tauriClient } from "@/services/tauri-client";
import { useCategoryStore } from "@/stores/use-category-store";
import { useLogStore } from "@/stores/use-log-store";
import { usePrivacyStore } from "@/stores/use-privacy-store";
import { useRuleStore } from "@/stores/use-rule-store";
import type { AutomationJob, AutomationLog } from "@/types/domain";

const scorer = ScoringStrategyFactory.create("mock");

function shouldExclude(filePath: string, patterns: string[]) {
  return patterns.some((pattern) => filePath.toLowerCase().includes(pattern.toLowerCase()));
}

export async function processAutomationJob(job: AutomationJob): Promise<void> {
  const start = performance.now();
  const categoryStore = useCategoryStore.getState();
  const ruleStore = useRuleStore.getState();
  const privacyStore = usePrivacyStore.getState();

  if (shouldExclude(job.filePath, privacyStore.exclusionPatterns)) {
    return;
  }

  const categories = categoryStore.categories.filter((item) => item.active).map((item) => item.name);
  const scoring = await scorer.score({
    fileName: job.fileName,
    contentPreview: job.contentPreview,
    categories,
  });

  const selected = scoring.categories[0];
  const targetFolder = RuleEngine.resolveTargetFolder(selected.name, ruleStore.categoryToFolderMap);
  const processingTimeMs = Math.round(performance.now() - start);

  if (!targetFolder) {
    const unmappedLog: AutomationLog = {
      id: crypto.randomUUID(),
      itemType: "file",
      fileName: job.fileName,
      originalPath: job.filePath,
      movedTo: "",
      chosenCategory: selected.name,
      score: selected.score,
      allScores: scoring.categories,
      timestamp: new Date().toISOString(),
      processingTimeMs,
      status: "failed",
      errorMessage: "No active mapping for selected category",
    };

    useLogStore.getState().appendLog(unmappedLog);
    await tauriClient.writeLog({ log: unmappedLog });
    return;
  }

  const destinationPath = `${targetFolder}/${job.fileName}`;
  await tauriClient.moveFile({ sourcePath: job.filePath, destinationPath });

  const log: AutomationLog = {
    id: crypto.randomUUID(),
    itemType: "file",
    fileName: job.fileName,
    originalPath: job.filePath,
    movedTo: destinationPath,
    chosenCategory: selected.name,
    score: selected.score,
    allScores: scoring.categories,
    timestamp: new Date().toISOString(),
    processingTimeMs,
    status: "completed",
  };

  useLogStore.getState().appendLog(log);
  await tauriClient.writeLog({ log });
}
