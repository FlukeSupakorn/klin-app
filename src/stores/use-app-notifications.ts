import { create } from "zustand";
import type { LucideIcon } from "lucide-react";

export type AppNotificationTone = "success" | "info" | "warning" | "error";

export interface AppNotificationAction {
  label: string;
  onClick: (notificationId: string) => void;
  /** When true, the notification dismisses after the action runs. Default: true. */
  dismissOnClick?: boolean;
}

export interface AppNotificationInput {
  tone?: AppNotificationTone;
  title: string;
  message?: string;
  icon?: LucideIcon;
  actions?: AppNotificationAction[];
  /** Milliseconds before auto-dismiss. Omit (or pass 0) to keep until manually dismissed. */
  autoDismissMs?: number;
}

export interface AppNotification extends AppNotificationInput {
  id: string;
  createdAt: number;
}

interface AppNotificationsState {
  notifications: AppNotification[];
  push: (input: AppNotificationInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useAppNotifications = create<AppNotificationsState>((set) => ({
  notifications: [],
  push: (input) => {
    counter += 1;
    const id = `notif-${Date.now()}-${counter}`;
    const next: AppNotification = {
      tone: "info",
      ...input,
      id,
      createdAt: Date.now(),
    };
    set((s) => ({ notifications: [...s.notifications, next] }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clear: () => set({ notifications: [] }),
}));

/**
 * Convenience helper for callers that don't want to pull the hook into a
 * non-component context (e.g. service modules, async handlers).
 */
export function pushAppNotification(input: AppNotificationInput): string {
  return useAppNotifications.getState().push(input);
}

export function dismissAppNotification(id: string): void {
  useAppNotifications.getState().dismiss(id);
}
