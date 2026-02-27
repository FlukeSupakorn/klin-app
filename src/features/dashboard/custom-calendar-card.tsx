import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { NormalizedCalendarEvent } from "@/features/calendar/google-calendar-service";
import { cn } from "@/lib/utils";

interface CustomCalendarCardProps {
  selectedDate: Date | undefined;
  visibleMonth: Date;
  isGoogleConnected: boolean;
  isLoadingMonth: boolean;
  isCalendarOffline: boolean;
  calendarError: string | null;
  getEventsForDate: (date: Date) => NormalizedCalendarEvent[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: Date, eventCount: number) => void;
}

export function CustomCalendarCard({
  selectedDate,
  visibleMonth,
  isGoogleConnected,
  isLoadingMonth,
  isCalendarOffline,
  calendarError,
  getEventsForDate,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: CustomCalendarCardProps) {
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const customCalendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ date: Date; inCurrentMonth: boolean }> = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      const date = new Date(year, month, index - firstWeekday + 1);
      days.push({ date, inCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push({ date: new Date(year, month, day), inCurrentMonth: true });
    }

    while (days.length % 7 !== 0) {
      const lastDate = days[days.length - 1]?.date ?? new Date(year, month, daysInMonth);
      const nextDate = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + 1);
      days.push({ date: nextDate, inCurrentMonth: false });
    }

    return days;
  }, [visibleMonth]);

  return (
    <>
      <Card className="rounded-3xl border-0 bg-muted/40 shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onPrevMonth}>
                Prev
              </Button>
              <p className="min-w-[130px] text-center text-sm font-medium">
                {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>
              <Button variant="ghost" size="sm" onClick={onNextMonth}>
                Next
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
            {weekdayLabels.map((label) => (
              <div key={label} className="py-1 text-center">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {customCalendarDays.map(({ date, inCurrentMonth }) => {
              const isSelected =
                Boolean(selectedDate) &&
                selectedDate?.getFullYear() === date.getFullYear() &&
                selectedDate?.getMonth() === date.getMonth() &&
                selectedDate?.getDate() === date.getDate();

              const dayEvents = getEventsForDate(date);
              const eventCount = dayEvents.length;

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => onSelectDate(date, eventCount)}
                  className={cn(
                    "relative h-10 rounded-lg text-sm transition-colors",
                    inCurrentMonth
                      ? "text-foreground hover:bg-background"
                      : "text-muted-foreground/60 hover:bg-background/60",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  <span>{date.getDate()}</span>
                  {eventCount > 0 && (
                    <span className="pointer-events-none absolute inset-x-1 bottom-1 flex flex-wrap items-center justify-center gap-0.5">
                      {dayEvents.map((event) => (
                        <span
                          key={event.id}
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: event.color }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isLoadingMonth && <p className="-mt-4 text-xs text-muted-foreground">Loading events...</p>}
      {!isLoadingMonth && isCalendarOffline && (
        <p className="-mt-4 text-xs text-muted-foreground">Offline. Showing cached events only.</p>
      )}
      {!isLoadingMonth && calendarError && !isCalendarOffline && (
        <p className="-mt-4 text-xs text-muted-foreground">{calendarError}</p>
      )}
      {!isGoogleConnected && !isLoadingMonth && (
        <p className="-mt-4 text-xs text-muted-foreground">Sign in from Settings to load Google events.</p>
      )}
    </>
  );
}
