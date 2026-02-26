import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  History,
  LayoutGrid,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bootstrapAppData } from "@/services/bootstrap-service";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/use-auth-store";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initializeAuth();
    void bootstrapAppData().catch(() => undefined);
  }, [initializeAuth]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background pt-4">
      <header className="mx-8 flex h-16 items-center justify-between rounded-2xl bg-card px-8">
        <div className="w-[220px]" />

        <nav className="flex items-center gap-1 rounded-full p-1">
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
        </nav>

        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Quick search..." 
              className="h-9 w-[240px] rounded-full bg-muted/50 pl-9 border-none focus-visible:ring-1" 
            />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-background p-8">
        <div className="mx-auto max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
