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
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-[72px] flex-col items-center border-r border-border bg-card py-6">
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
          <span className="text-lg font-semibold">K</span>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="h-6 w-6" />
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-8">
          <h1 className="text-xl font-bold tracking-tight">Klin Organizer</h1>
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
        
        <main className="flex-1 overflow-y-auto bg-muted/10 p-8">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
