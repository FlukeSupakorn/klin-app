import { CheckCircle2, Info, TriangleAlert, OctagonX, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppNotification, AppNotificationTone } from "@/stores/use-app-notifications";
import { cn } from "@/lib/utils";

interface ToneTokens {
  /** CSS variable expression usable in style.color / background-via-color-mix. */
  color: string;
  /** Default lucide icon when the caller didn't supply one. */
  defaultIcon: LucideIcon;
}

const TONE_TOKENS: Record<AppNotificationTone, ToneTokens> = {
  success: { color: "var(--success, #10b981)", defaultIcon: CheckCircle2 },
  info: { color: "var(--primary)", defaultIcon: Info },
  warning: { color: "var(--warning, #f59e0b)", defaultIcon: TriangleAlert },
  error: { color: "var(--destructive)", defaultIcon: OctagonX },
};

interface NotificationCardProps {
  notification: AppNotification;
  onDismiss: () => void;
}

export function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  const tone = notification.tone ?? "info";
  const tokens = TONE_TOKENS[tone];
  const Icon = notification.icon ?? tokens.defaultIcon;

  return (
    <div
      role="status"
      className="pointer-events-auto relative flex w-80 items-start gap-3 overflow-hidden rounded-[14px] border border-border bg-card px-3.5 py-3 shadow-lg shadow-black/10"
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: tokens.color }}
      />

      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{
          background: `color-mix(in oklab, ${tokens.color} 18%, transparent)`,
          border: `1px solid color-mix(in oklab, ${tokens.color} 30%, transparent)`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: tokens.color }} />
      </div>

      <div className="min-w-0 flex-1 pr-5">
        <div className="truncate text-[12.5px] font-bold text-foreground">
          {notification.title}
        </div>
        {notification.message && (
          <div className="mt-0.5 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground break-words">
            {notification.message}
          </div>
        )}

        {notification.actions && notification.actions.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            {notification.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  action.onClick(notification.id);
                  if (action.dismissOnClick !== false) onDismiss();
                }}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-bold transition-colors",
                  "hover:opacity-90",
                )}
                style={{
                  background: `color-mix(in oklab, ${tokens.color} 14%, transparent)`,
                  color: tokens.color,
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
