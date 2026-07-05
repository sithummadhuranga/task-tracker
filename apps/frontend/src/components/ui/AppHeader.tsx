import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";
import { initials } from "../../lib/initials";

interface AppHeaderProps {
  active: "tasks" | "admin";
}

function navLinkClasses(isActive: boolean): string {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-2 hover:text-ink"
  }`;
}

export function AppHeader({ active }: AppHeaderProps) {
  const { user, logout, hasPermission } = useAuth();
  const canSeeAdmin = hasPermission("role:manage", "user:manage", "permission:assign");

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-ink">
              T
            </span>
            <span className="hidden sm:inline">Task Tracker</span>
          </div>
          <nav className="flex items-center gap-1" aria-label="Primary">
            <Link to="/" className={navLinkClasses(active === "tasks")}>
              Tasks
            </Link>
            {canSeeAdmin && (
              <Link to="/admin" className={navLinkClasses(active === "admin")}>
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {user ? initials(user.name) : ""}
            </span>
            <span className="text-sm text-muted">{user?.name ?? "Anonymous"}</span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-primary/40 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
