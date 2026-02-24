import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  History,
  LayoutGrid,
  Search,
  Settings,
  Tags,
  Zap,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bootstrapAppData } from "@/services/bootstrap-service";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/automation", label: "Automation", icon: Zap },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/rules", label: "Rules", icon: GitBranch },
  { to: "/logs", label: "Logs", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  useEffect(() => {
    void bootstrapAppData().catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[72px_1fr] rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <aside className="flex flex-col items-center border-r border-border/70 pr-4">
          <div className="mb-8 mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
            <span className="text-lg font-semibold">K</span>
          </div>
          <nav className="flex flex-1 flex-col items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={item.label}
                className={({ isActive }) =>
                  cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-5 w-5" />
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="px-6">
          <header className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-4xl font-semibold tracking-tight">Welcome back 👋</h1>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-[280px] items-center gap-2 rounded-full border border-border bg-background px-4 text-muted-foreground">
                <Search className="h-4 w-4" />
                <span className="text-sm">Search something</span>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                SK
              </div>
            </div>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
