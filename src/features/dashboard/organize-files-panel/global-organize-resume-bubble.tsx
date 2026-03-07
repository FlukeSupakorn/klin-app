import { useNavigate } from "react-router-dom";
import { OrganizeResumeBubble } from "@/features/dashboard/organize-files-panel/organize-resume-bubble";
import { useOrganizeWorkflowStore } from "@/features/dashboard/organize-files-panel/use-organize-workflow-store";
import { computeOrganizeWorkflowMetrics } from "@/features/dashboard/organize-files-panel/organize-workflow-utils";

export function GlobalOrganizeResumeBubble() {
  const navigate = useNavigate();
  const {
    items,
    modalOpen,
    isAnalyzing,
    resumeDismissed,
    setModalOpen,
    cancelPendingItems,
  } = useOrganizeWorkflowStore((state) => state);

  const metrics = computeOrganizeWorkflowMetrics(items, modalOpen, isAnalyzing, resumeDismissed);

  return (
    <OrganizeResumeBubble
      show={metrics.showResumeOrganizeBubble}
      isAnalyzing={isAnalyzing}
      processingCount={metrics.processingCount}
      queuedCount={metrics.queuedCount}
      unresolvedCount={metrics.unresolvedCount}
      onOpen={() => {
        setModalOpen(true);
        void navigate("/");
      }}
      onDismiss={() => cancelPendingItems()}
      dismissLabel="Cancel organize"
    />
  );
}
