import { useEffect } from "react";
import { useAppNotifications } from "@/stores/use-app-notifications";
import { NotificationCard } from "./notification-card";

const MAX_VISIBLE = 5;

export function NotificationStack() {
  const notifications = useAppNotifications((s) => s.notifications);
  const dismiss = useAppNotifications((s) => s.dismiss);

  useEffect(() => {
    const timers: number[] = [];
    for (const n of notifications) {
      if (n.autoDismissMs && n.autoDismissMs > 0) {
        const remaining = n.autoDismissMs - (Date.now() - n.createdAt);
        const delay = Math.max(0, remaining);
        const id = window.setTimeout(() => dismiss(n.id), delay);
        timers.push(id);
      }
    }
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [notifications, dismiss]);

  if (notifications.length === 0) return null;

  // Show newest at the bottom, cap at MAX_VISIBLE.
  const visible = notifications.slice(-MAX_VISIBLE);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2"
      aria-live="polite"
      aria-label="App notifications"
    >
      {visible.map((n) => (
        <div key={n.id} className="klin-fade-in">
          <NotificationCard notification={n} onDismiss={() => dismiss(n.id)} />
        </div>
      ))}
    </div>
  );
}
