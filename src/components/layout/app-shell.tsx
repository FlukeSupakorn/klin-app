import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  Bot,
  FolderCog,
  FolderTree,
  Gauge,
  ListTree,
  NotebookPen,
  Settings,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bootstrapAppData } from "@/services/bootstrap-service";

const navItems = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/categories", label: "Categories", icon: ListTree },
  { to: "/rules", label: "Rules Engine", icon: FolderTree },
  { to: "/logs", label: "Activity Log", icon: Activity },
  { to: "/automation", label: "Automation", icon: Bot },
  { to: "/privacy", label: "Privacy", icon: Shield },
  { to: "/file-health", label: "File Health", icon: FolderCog },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/developer", label: "Developer", icon: SlidersHorizontal },
];

export function AppShell() {
  useEffect(() => {
    void bootstrapAppData().catch(() => undefined);
  }, []);

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-background">
      <aside className="border-r border-border bg-card p-4">
        <h1 className="mb-6 px-3 text-xl font-semibold">Klin App</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
