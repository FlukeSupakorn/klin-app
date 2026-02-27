import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrganizeFilesPanel } from "@/features/dashboard/organize-files-panel";
import { ActiveCategoriesCard } from "@/features/dashboard/active-categories-card";
import { AutomationEngineCard } from "@/features/dashboard/automation-engine-card";
import { RecentMovementsSection } from "@/features/dashboard/recent-movements-section";
import { CustomCalendarCard } from "@/features/dashboard/custom-calendar-card";
import { QuickNotesCard } from "@/features/dashboard/quick-notes-card";
import { CategoryDistributionCard } from "@/features/dashboard/category-distribution-card";
import { SettingsManagementDialogs } from "@/features/settings/settings-management-dialogs";
import { CalendarEventModal } from "@/features/calendar/event-modal";
import type { HistoryEntry } from "@/features/history/history-types";
import { historyApiService } from "@/services/history-api-service";
import { useCalendarStore } from "@/features/calendar/use-calendar-store";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { useAutomationStore } from "@/stores/use-automation-store";
import { useCategoryManagementStore } from "@/stores/use-category-management-store";
import { useCategoryStore } from "@/stores/use-category-store";
import { useLogStore } from "@/stores/use-log-store";

export function DashboardPage() {
  const navigate = useNavigate();
  const logs = useLogStore((state) => state.logs);
  const categories = useCategoryStore((state) => state.categories);
  const managedCategories = useCategoryManagementStore((state) => state.categories);
  const watchedFolders = useAutomationStore((state) => state.watchedFolders);
  const isRunning = useAutomationStore((state) => state.isRunning);
  const lastScanTime = useAutomationStore((state) => state.lastScanTime);
  const selectedDate = useCalendarStore((state) => state.selectedDate);
  const visibleMonth = useCalendarStore((state) => state.visibleMonth);
  const setVisibleMonth = useCalendarStore((state) => state.setVisibleMonth);
  const setSelectedDate = useCalendarStore((state) => state.setSelectedDate);
  const openDateModal = useCalendarStore((state) => state.openDateModal);
  const loadVisibleMonth = useCalendarStore((state) => state.loadVisibleMonth);
  const getEventsForDate = useCalendarStore((state) => state.getEventsForDate);
  const isLoadingMonth = useCalendarStore((state) => state.isLoadingMonth);
  const isCalendarOffline = useCalendarStore((state) => state.isOffline);
  const calendarError = useCalendarStore((state) => state.error);
  const authToken = useAuthStore((state) => state.accessToken);
  const [openCategoryManager, setOpenCategoryManager] = useState(false);
  const [recentHistoryEntries, setRecentHistoryEntries] = useState<HistoryEntry[]>([]);

  const activeManagedCategories = managedCategories.filter((category) => category.enabled);
  const isGoogleConnected = Boolean(authToken);

  useEffect(() => {
    if (!isGoogleConnected) {
      return;
    }

    void loadVisibleMonth(visibleMonth);
  }, [isGoogleConnected, loadVisibleMonth, visibleMonth]);

  useEffect(() => {
    void (async () => {
      try {
        const historyRows = await historyApiService.list();
        const rows = historyRows
          .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
          .slice(0, 5);

        setRecentHistoryEntries(rows);
      } catch {
        setRecentHistoryEntries([]);
      }
    })();
  }, []);

  const openDateWithEvents = (date: Date, _eventCount: number) => {
    setSelectedDate(date);
    openDateModal(date);

    if (isGoogleConnected) {
      setVisibleMonth(date);
      void loadVisibleMonth(date);
    }
  };

  const handleOpenRecentHistoryEntry = (entryId: string) => {
    navigate("/history", { state: { expandedEntryId: entryId } });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 pb-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,1fr)]">
      <section className="space-y-6">

        <OrganizeFilesPanel />

        <ActiveCategoriesCard
          activeManagedCategories={activeManagedCategories}
          onOpenCategoryManager={() => setOpenCategoryManager(true)}
        />

        <AutomationEngineCard
          isRunning={isRunning}
          watchedFoldersCount={watchedFolders.length}
          lastScanTime={lastScanTime}
        />

        <RecentMovementsSection
          recentEntries={recentHistoryEntries}
          onOpenEntry={handleOpenRecentHistoryEntry}
        />
      </section>

      <section className="space-y-6">
        <CustomCalendarCard
          selectedDate={selectedDate}
          visibleMonth={visibleMonth}
          isGoogleConnected={isGoogleConnected}
          isLoadingMonth={isLoadingMonth}
          isCalendarOffline={isCalendarOffline}
          calendarError={calendarError}
          getEventsForDate={getEventsForDate}
          onPrevMonth={() => {
            const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
            setVisibleMonth(previousMonth);
            if (isGoogleConnected) {
              void loadVisibleMonth(previousMonth);
            }
          }}
          onNextMonth={() => {
            const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
            setVisibleMonth(nextMonth);
            if (isGoogleConnected) {
              void loadVisibleMonth(nextMonth);
            }
          }}
          onSelectDate={openDateWithEvents}
        />

        <QuickNotesCard />

        <CategoryDistributionCard categories={categories} logs={logs} />
      </section>

      <SettingsManagementDialogs
        open={openCategoryManager}
        sections={["categories"]}
        title="Manage Categories"
        description="Edit your categories."
        onClose={() => setOpenCategoryManager(false)}
      />

      <CalendarEventModal />
    </div>
  );
}
