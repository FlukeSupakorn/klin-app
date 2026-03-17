import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-6 w-full",

        caption: "flex justify-between items-center pb-4 px-2",
        caption_label: "text-2xl font-semibold tracking-tight",

        nav: "flex items-center gap-2",
        nav_button: cn(
          "h-9 w-9 rounded-xl p-0 shadow-md transition-all",
          "bg-linear-to-r from-fuchsia-500 to-pink-500",
          "text-white hover:scale-105 hover:shadow-lg"
        ),
        nav_button_previous: "",
        nav_button_next: "",

        table: "w-full border-collapse",
        head_row: "flex justify-between mb-2",
        head_cell:
          "w-10 text-center text-sm font-semibold text-muted-foreground",

        row: "flex justify-between mb-1",
        cell: "relative text-center text-sm",

        day: cn(
          "h-10 w-10 rounded-lg transition-all",
          "hover:bg-muted"
        ),

        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-linear-to-r from-fuchsia-500 to-pink-500 text-white shadow-md",

        day_today:
          "border border-primary text-primary font-semibold",

        day_outside:
          "text-muted-foreground opacity-30",

        day_disabled:
          "text-muted-foreground opacity-30",

        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        ...components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export function CalendarDemo() {
  const [date, setDate] = React.useState<Date | undefined>(new Date())

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-lg border"
      captionLayout="dropdown"
      startMonth={new Date(2020, 0)}
      endMonth={new Date(2030, 11)}
    />
  )
}

export { Calendar };
