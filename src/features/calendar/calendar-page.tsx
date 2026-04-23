import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, WifiOff, AlertCircle, LogIn, Clock, ExternalLink } from "lucide-react";
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
    if (!isGoogleConnected) { wasConnectedRef.current = false; return; }
    if (!wasConnectedRef.current) { wasConnectedRef.current = true; void initializeMonths(); }
    else { void loadVisibleMonth(visibleMonth); }
  }, [isGoogleConnected, visibleMonth, initializeMonths, loadVisibleMonth]);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ date: Date; inCurrentMonth: boolean }> = [];
    for (let i = 0; i < firstWeekday; i++)
      days.push({ date: new Date(year, month, i - firstWeekday + 1), inCurrentMonth: false });
    for (let d = 1; d <= daysInMonth; d++)
      days.push({ date: new Date(year, month, d), inCurrentMonth: true });
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

  const selEvts = selectedDate ? getEventsForDate(selectedDate) : [];
  const selectedDateStr = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex-1">
          <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">Schedule</div>
          <h1 className="mt-0.5 text-[21px] font-extrabold tracking-tight text-foreground" style={{ letterSpacing: "-0.4px" }}>
            Calendar
          </h1>
        </div>
        {isGoogleConnected && (
          <div
            className="flex items-center gap-1.5 rounded-[12px] border px-3 py-1.5"
            style={{ background: "rgba(74,124,247,0.06)", borderColor: "rgba(74,124,247,0.2)" }}
          >
            <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.8 10.2H12v3.8h5.7c-.5 2.6-2.7 4.4-5.7 4.4-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.5 0 2.9.5 4 1.4l2.8-2.8C16.7 2.8 14.5 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.5 0 9.7-3.8 9.7-10-.1-.6-.1-1.2-.2-1.8z"/>
            </svg>
            <span className="text-[12px] font-semibold text-primary">Google Calendar connected</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
        )}
      </div>

      {/* Status banners */}
      {!isGoogleConnected && (
        <div className="flex shrink-0 items-center gap-3 rounded-[12px] border border-border bg-card px-4 py-3">
          <LogIn className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Connect Google Calendar in{" "}
            <Link to="/settings" className="font-bold text-primary underline-offset-2 hover:underline">Settings</Link>
            {" "}to see your events.
          </p>
        </div>
      )}
      {isCalendarOffline && (
        <div className="flex shrink-0 items-center gap-3 rounded-[12px] border border-border bg-card px-4 py-3">
          <WifiOff className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Offline — showing cached events only.</p>
        </div>
      )}
      {calendarError && !isCalendarOffline && (
        <div className="flex shrink-0 items-center gap-3 rounded-[12px] border border-destructive/20 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{calendarError}</p>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-4 overflow-hidden">
        {/* Calendar grid */}
        <div
          className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card"
          style={{ boxShadow: "0 2px 14px rgba(74,124,247,0.07)" }}
        >
          {/* Month nav */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                style={{ background: "linear-gradient(135deg,#4a7cf7,#7c3aed)" }}
              >
                <CalendarDays className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-foreground" style={{ letterSpacing: "-0.3px" }}>
                  {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
                {isLoadingMonth && <span className="text-[11px] text-muted-foreground">Loading...</span>}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={goToPrevMonth}
                className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={goToNextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border transition-colors hover:bg-muted"
              >
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="py-1.5 text-center text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  {d}
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

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => handleSelectDate(date, dayEvents.length)}
                    className={cn(
                      "relative flex min-h-[52px] flex-col items-center gap-1 rounded-[11px] px-1 py-1.5 transition-all duration-150",
                      inCurrentMonth
                        ? "cursor-pointer text-foreground"
                        : "cursor-default text-muted-foreground/40",
                    )}
                    style={{
                      background: isToday
                        ? "linear-gradient(135deg,#4a7cf7,#7c3aed)"
                        : isSelected
                          ? "rgba(74,124,247,0.08)"
                          : undefined,
                      border: isSelected && !isToday ? "1.5px solid var(--primary)" : "1.5px solid transparent",
                      boxShadow: isToday ? "0 4px 14px rgba(74,124,247,0.35)" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isToday && inCurrentMonth)
                        e.currentTarget.style.background = "var(--muted)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isToday && !isSelected)
                        e.currentTarget.style.background = "transparent";
                      else if (isSelected && !isToday)
                        e.currentTarget.style.background = "rgba(74,124,247,0.08)";
                    }}
                  >
                    <span
                      className={cn(
                        "text-[13px]",
                        isToday ? "font-extrabold text-white" : isSelected ? "font-extrabold text-primary" : "font-medium",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {dayEvents.slice(0, 3).map((ev, ei) => (
                          <div
                            key={ei}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: isToday ? "rgba(255,255,255,0.8)" : ev.color }}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: isToday ? "rgba(255,255,255,0.5)" : "var(--muted-foreground)" }}
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Day detail panel */}
        <div
          className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card"
          style={{ boxShadow: "0 2px 14px rgba(74,124,247,0.07)" }}
        >
          <div className="shrink-0 border-b border-border p-4">
            <div className="text-[11px] font-bold text-muted-foreground">Selected day</div>
            <div className="mt-1 text-[17px] font-extrabold text-foreground" style={{ letterSpacing: "-0.3px" }}>
              {selectedDateStr || "Choose a date"}
            </div>
            <div className="mt-1.5">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={
                  selEvts.length === 0
                    ? { background: "var(--muted)", color: "var(--muted-foreground)" }
                    : { background: "rgba(74,124,247,0.10)", color: "#4a7cf7" }
                }
              >
                {selEvts.length === 0 ? "No events" : `${selEvts.length} event${selEvts.length > 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-3">
            {selEvts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-5 opacity-70">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-border"
                  style={{ background: "var(--muted)" }}
                >
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <div className="text-[13.5px] font-bold text-foreground">Free day</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">No events scheduled</div>
                </div>
              </div>
            ) : (
              selEvts.map((ev, i) => (
                <div
                  key={ev.id}
                  className="flex cursor-pointer gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40"
                >
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ev.color }} />
                    {i < selEvts.length - 1 && (
                      <div className="mt-1 w-0.5 flex-1 rounded-sm bg-border" style={{ minHeight: 20 }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="text-[13px] font-bold text-foreground">{ev.title}</div>
                    {ev.time && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[11.5px] text-muted-foreground">{ev.time}</span>
                      </div>
                    )}
                  </div>
                  <button className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-border bg-muted">
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 border-t border-border p-3 text-center text-[10.5px] text-muted-foreground">
            {isGoogleConnected ? "Synced with Google Calendar" : "Connect Google Calendar in Settings"}
          </div>
        </div>
      </div>

      <CalendarEventModal />
    </div>
  );
}
