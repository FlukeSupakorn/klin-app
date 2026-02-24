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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background pt-4">
      <header className="mx-8 flex h-16 items-center justify-between rounded-2xl bg-card px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
            <span className="text-base font-semibold">K</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Klin Organizer</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Quick search..." 
              className="h-9 w-[240px] rounded-full bg-muted/50 pl-9 border-none focus-visible:ring-1" 
            />
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            SK
          </div>
        </div>
      </header>

      <nav className="flex items-center justify-center py-2">
        <div className="flex items-center gap-1 rounded-full p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto bg-background p-8">
        <div className="mx-auto max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
