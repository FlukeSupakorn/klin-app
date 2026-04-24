import { Skeleton } from "@/components/ui/skeleton";

function SidebarSkeleton() {
  return (
    <aside
      className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-card"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      {/* Logo + watcher card */}
      <div className="shrink-0 border-b border-border p-4 space-y-4">
        {/* Logo row */}
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-[10px]" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Watcher card */}
        <Skeleton className="h-[82px] w-full rounded-[14px]" />
      </div>

      {/* Nav items */}
      <div className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
        <Skeleton className="mb-3 h-2.5 w-12 rounded-full" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded-[6px]" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
        <Skeleton className="mb-3 mt-4 h-2.5 w-12 rounded-full" />
        <div className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2">
          <Skeleton className="h-4 w-4 shrink-0 rounded-[6px]" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </div>

      {/* User footer */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-hidden px-[26px] py-[26px] pb-[22px]">
      {/* Header */}
      <div className="flex shrink-0 items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-9 w-32 rounded-[12px]" />
      </div>

      {/* Category cards row */}
      <div className="grid shrink-0 grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[90px] rounded-[16px]" />
        ))}
      </div>

      {/* Bottom two panels */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_340px] gap-4 overflow-hidden">
        {/* Left: organize panel */}
        <Skeleton className="rounded-[18px]" />
        {/* Right: recent activity */}
        <div className="flex flex-col gap-3 overflow-hidden rounded-[18px] border border-border bg-card p-4">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2.5 flex-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 overflow-hidden rounded-[12px] border border-border p-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-[10px]" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Skeleton className="h-3 w-full max-w-[140px]" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="h-2.5 w-8 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSkeleton() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <SidebarSkeleton />
      <DashboardSkeleton />
    </div>
  );
}
