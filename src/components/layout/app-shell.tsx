import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
  FileText,
  History,
  LayoutGrid,
  Search,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bootstrapAppData } from "@/services/bootstrap-service";
import { useAuthStore } from "@/features/auth/use-auth-store";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/history", label: "History", icon: History },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const profile = useAuthStore((state) => state.profile);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initializeAuth();
    void bootstrapAppData().catch(() => undefined);
  }, [initializeAuth]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const profileInitial = (profile?.name?.trim()?.charAt(0) || "K").toUpperCase();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <header className="flex h-16 flex-shrink-0 items-center gap-3 px-6">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary">
          <span className="text-sm font-black tracking-tight text-primary-foreground">KL</span>
        </div>

        <nav className="flex items-center gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "group flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
                  isActive
                    ? "bg-card border border-border shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <item.icon
                  className={cn(
                    "h-[17px] w-[17px] transition-transform duration-150 group-hover:scale-110",
                    isActive ? "text-primary" : "",
                  )}
                />
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-2 flex items-center">
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border bg-card transition-all duration-200",
              searchOpen ? "w-52 px-3 py-2" : "h-9 w-9 justify-center",
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (searchOpen) {
                  setSearchOpen(false);
                  setSearchQuery("");
                } else {
                  setSearchOpen(true);
                }
              }}
              className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {searchOpen ? <X className="h-[17px] w-[17px]" /> : <Search className="h-[17px] w-[17px]" />}
            </button>
            {searchOpen && (
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            )}
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-foreground">
          {profileInitial}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
