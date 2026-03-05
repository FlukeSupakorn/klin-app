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
import klinLogo from "@/assets/klin-logo.svg";

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
      <header className="flex h-20 flex-shrink-0 items-center gap-4 px-8 lg:px-10">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
          <img src={klinLogo} alt="KLIN" className="h-10 w-10 object-contain" />
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "group flex h-11 items-center justify-center gap-2 rounded-full px-4 transition-all duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-4 w-4 transition-transform duration-150 group-hover:scale-105",
                      isActive ? "text-primary-foreground" : "",
                    )}
                  />
                  <span className="text-xs font-semibold leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-2 flex items-center">
          <div
            className={cn(
              "flex items-center gap-2 rounded-full bg-muted transition-all duration-200",
              searchOpen ? "h-11 w-56 px-4" : "h-11 w-11 justify-center",
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

        <div className="flex flex-shrink-0 items-center gap-3">
          {profile && (
            <div className="text-right">
              <p className="text-sm font-semibold leading-none text-foreground">{profile.name}</p>
              <p className="mt-0.5 text-[11px] font-black leading-none text-muted-foreground">{profile.email}</p>
            </div>
          )}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-foreground ring-2 ring-border">
            {profile?.picture ? (
              <img src={profile.picture} alt={profile.name ?? "Profile"} className="h-full w-full rounded-full object-cover" />
            ) : (
              profileInitial
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-6 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
