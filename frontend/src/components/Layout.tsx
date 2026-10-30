import { NavLink, Outlet } from "react-router-dom";
import { Activity, LayoutDashboard, ListChecks, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Jobs", icon: ListChecks, end: false },
  { to: "/jobs/new", label: "Register Job", icon: PlusCircle, end: false },
];

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-[hsl(217_80%_60%/0.12)] bg-[hsl(224_55%_7%/0.7)] backdrop-blur-xl">
        <div className="flex items-center gap-2.5 border-b border-[hsl(217_80%_60%/0.12)] px-5 py-5">
          <span className="icon-chip">
            <Activity className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <div>
            <span className="glow-text block text-sm font-semibold tracking-tight">
              Job Platform
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Operations
            </span>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all",
                  isActive
                    ? "bg-gradient-to-r from-[hsl(211_100%_62%/0.2)] to-transparent font-medium text-foreground shadow-[inset_2px_0_0_hsl(211_100%_62%),inset_0_1px_0_hsl(0_0%_100%/0.05)]"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
