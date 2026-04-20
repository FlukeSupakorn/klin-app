import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, WifiOff, AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarEventModal } from "@/features/calendar/event-modal";
import { useCalendarStore } from "@/hooks/calendar/use-calendar-store";
import { useAuthStore } from "@/hooks/auth/use-auth-store";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPage() {
  const selectedDate = useCalendarStore((state) => state.selectedDate);
  const visibleMonth = useCalendarStore((state) => state.visibleMonth);
  const setVisibleMonth = useCalendarStore((state) => state.setVisibleMonth);
  const setSelectedDate = useCalendarStore((state) => state.setSelectedDate);
  const openDateModal = useCalendarStore((state) => state.openDateModal);
  const loadVisibleMonth = useCalendarStore((state) => state.loadVisibleMonth);
  const prefetchMonth = useCalendarStore((state) => state.prefetchMonth);
  const initializeMonths = useCalendarStore((state) => state.initializeMonths);
  const getEventsForDate = useCalendarStore((state) => state.getEventsForDate);
  const isLoadingMonth = useCalendarStore((state) => state.isLoadingMonth);
  const isCalendarOffline = useCalendarStore((state) => state.isOffline);
  const calendarError = useCalendarStore((state) => state.error);
  const authInitialized = useAuthStore((state) => state.initialized);
  const authStatus = useAuthStore((state) => state.status);
  const isGoogleConnected = authInitialized && authStatus === "authenticated";

  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (!isGoogleConnected) {
      wasConnectedRef.current = false;
      return;
    }
    if (!wasConnectedRef.current) {
      wasConnectedRef.current = true;
      void initializeMonths();
    } else {
      void loadVisibleMonth(visibleMonth);
    }
  }, [isGoogleConnected, visibleMonth, initializeMonths, loadVisibleMonth]);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ date: Date; inCurrentMonth: boolean }> = [];

    for (let i = 0; i < firstWeekday; i++) {
      days.push({ date: new Date(year, month, i - firstWeekday + 1), inCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), inCurrentMonth: true });
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1]!.date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      days.push({ date: next, inCurrentMonth: false });
    }
    return days;
  }, [visibleMonth]);

  const goToPrevMonth = () => {
    const prev = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    const prevPrev = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 2, 1);
    setVisibleMonth(prev);
    if (isGoogleConnected) void prefetchMonth(prevPrev);
  };

  const goToNextMonth = () => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    const nextNext = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 2, 1);
    setVisibleMonth(next);
    if (isGoogleConnected) void prefetchMonth(nextNext);
  };

  const handleSelectDate = (date: Date, _eventCount: number) => {
    setSelectedDate(date);
    openDateModal(date);
  };

  const today = new Date();

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Schedule</p>
        <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Calendar</h2>
      </div>

      {!isGoogleConnected && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <LogIn className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Connect Google Calendar in{" "}
            <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
              Settings
            </Link>{" "}
            to see your events.
          </p>
        </div>
      )}
      {isCalendarOffline && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <WifiOff className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Offline — showing cached events only.</p>
        </div>
      )}
      {calendarError && !isCalendarOffline && (
        <div className="flex items-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-secondary" />
          <p className="text-sm text-secondary">{calendarError}</p>
        </div>
      )}

      <Card className="border border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Calendar</p>
            </div>
            <div className="flex items-center gap-2">
              {isLoadingMonth && (
                <span className="text-xs text-muted-foreground">Loading...</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPrevMonth}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[140px] text-center text-sm font-bold">
                {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextMonth}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-2 text-center text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, inCurrentMonth }) => {
              const isToday =
                date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();

              const isSelected =
                selectedDate != null &&
                selectedDate.getDate() === date.getDate() &&
                selectedDate.getMonth() === date.getMonth() &&
                selectedDate.getFullYear() === date.getFullYear();

              const dayEvents = getEventsForDate(date);
              const eventCount = dayEvents.length;

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(date, eventCount)}
                  className={cn(
                    "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-medium transition-all duration-150",
                    inCurrentMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/40 hover:bg-muted/50",
                    isToday && !isSelected && "border border-primary/40 text-primary",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  <span>{date.getDate()}</span>
                  {eventCount > 0 && !isSelected && (
                    <span className="flex gap-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: event.color }}
                        />
                      ))}
                    </span>
                  )}
                  {eventCount > 0 && isSelected && (
                    <span className="text-[10px] font-bold opacity-80">{eventCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CalendarEventModal />
    </div>
  );
}
