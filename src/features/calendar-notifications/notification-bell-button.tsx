import { Bell } from "lucide-react";
import { useEffect } from "react";
import {
  selectUnreadCount,
  useCalendarNotificationsStore,
} from "@/stores/use-calendar-notifications-store";
import { useAuthStore } from "@/hooks/auth/use-auth-store";

interface NotificationBellButtonProps {
  onClick: () => void;
  open: boolean;
}

export function NotificationBellButton({ onClick, open }: NotificationBellButtonProps) {
  const events = useCalendarNotificationsStore((s) => s.events);
  const refresh = useCalendarNotificationsStore((s) => s.refresh);
  const isAuthed = useAuthStore((s) => s.status === "authenticated");
  const unreadCount = selectUnreadCount({ events });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasUnread = unreadCount > 0;
  const baseColor = isAuthed ? "var(--foreground)" : "var(--muted-foreground)";

  return (
    <button
      type="button"
      onClick={onClick}
      title={isAuthed ? "Calendar events detected" : "Sign in to Google to enable"}
      aria-label="Calendar notifications"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border bg-card transition-colors"
      style={{
        borderColor: open ? "var(--primary)" : "var(--border)",
        boxShadow: open ? "0 0 0 3px var(--primary-soft)" : "var(--shadow-xs)",
        opacity: isAuthed ? 1 : 0.6,
      }}
    >
      <Bell className="h-4 w-4" style={{ color: open ? "var(--primary)" : baseColor }} />
      {isAuthed && hasUnread && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
          style={{ background: "var(--destructive)" }}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
