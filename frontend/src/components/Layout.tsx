import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Activity, LayoutDashboard, ListChecks, LogOut, Moon, PlusCircle, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { Badge } from "@/components/ui/badge";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Jobs", icon: ListChecks, end: false },
  { to: "/jobs/new", label: "Register Job", icon: PlusCircle, end: false, adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(getTheme);
  const items = nav.filter((item) => !item.adminOnly || user?.role === "ADMIN");
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[hsl(217_80%_60%/0.12)] bg-card/70 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 border-b border-[hsl(217_80%_60%/0.12)] px-5 py-5">
          <span className="icon-chip">
            <Activity className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <div>
            <span className="glow-text block text-sm font-semibold tracking-tight">
              Distributed Job
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Management Platform
            </span>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Main">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-[hsl(211_100%_62%/0.2)] to-transparent font-medium text-foreground shadow-[inset_2px_0_0_hsl(211_100%_62%),inset_0_1px_0_hsl(0_0%_100%/0.05)]"
                    : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted/40 hover:text-foreground",
                )
              }
            >
              <Icon
                className="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
                aria-hidden
              />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-[hsl(217_80%_60%/0.12)] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.username}</p>
              {user &&
                user.username.toLowerCase() !==
                  (user.role === "ADMIN" ? "admin" : "viewer") && (
                  <Badge
                    variant={user.role === "ADMIN" ? "info" : "default"}
                    className="mt-1"
                  >
                    {user.role === "ADMIN" ? "Admin" : "Viewer"}
                  </Badge>
                )}
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>
      <main className="relative flex-1 overflow-y-auto">
        <button
          type="button"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          onClick={() => setTheme(toggleTheme())}
          className="fixed right-4 top-4 z-40 rounded-xl border border-border bg-card/70 p-2.5 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden />
          ) : (
            <Moon className="h-4 w-4" aria-hidden />
          )}
        </button>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
