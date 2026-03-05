import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CalendarDays,
  FileText,
  HeartPulse,
  History,
  LayoutGrid,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bootstrapAppData } from "@/services/bootstrap-service";
import { useAuthStore } from "@/features/auth/use-auth-store";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/history", label: "History", icon: History },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/automation", label: "Automation", icon: Zap },
  { to: "/categories", label: "Categories", icon: Tag },
  { to: "/rules", label: "Rules", icon: SlidersHorizontal },
  { to: "/file-health", label: "File Health", icon: HeartPulse },
  { to: "/privacy", label: "Privacy", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/history": "History",
  "/calendar": "Calendar",
  "/notes": "Notes",
  "/automation": "Automation",
  "/categories": "Categories",
  "/rules": "Rules",
  "/file-health": "File Health",
  "/privacy": "Privacy",
  "/settings": "Settings",
};

export function AppShell() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Klin";

  useEffect(() => {
    void initializeAuth();
    void bootstrapAppData().catch(() => undefined);
  }, [initializeAuth]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="flex h-full w-16 flex-shrink-0 flex-col items-center border-r border-border bg-background py-4">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <span className="text-sm font-black text-primary-foreground tracking-tight">KL</span>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <item.icon className="h-[18px] w-[18px] transition-transform duration-150 group-hover:scale-110" />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          title="Quick Action"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-150 hover:scale-110"
        >
          <Plus className="h-5 w-5" />
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="text-base font-black uppercase tracking-widest text-foreground">
            {pageTitle}
          </h1>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
