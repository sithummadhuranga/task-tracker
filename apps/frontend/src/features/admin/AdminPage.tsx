import { useState, type KeyboardEvent } from "react";
import { AppHeader } from "../../components/ui/AppHeader";
import { useAuth } from "../auth/AuthContext";
import { RolesTab } from "./RolesTab";
import { UsersTab } from "./UsersTab";

const TAB_LABEL = { roles: "Roles", users: "Users" } as const;
type AdminTab = keyof typeof TAB_LABEL;

interface AdminTabsProps {
  tabs: AdminTab[];
  tab: AdminTab;
  onChange: (tab: AdminTab) => void;
}

function AdminTabs({ tabs, tab, onChange }: AdminTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    const nextIndex =
      event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    if (next) {
      onChange(next);
    }
  }

  return (
    <div role="tablist" aria-label="Admin sections" className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((value, index) => (
        <button
          key={value}
          type="button"
          role="tab"
          id={`admin-tab-${value}`}
          aria-selected={tab === value}
          aria-controls={`admin-panel-${value}`}
          tabIndex={tab === value ? 0 : -1}
          onClick={() => {
            onChange(value);
          }}
          onKeyDown={(event) => {
            handleKeyDown(event, index);
          }}
          className={`border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
            tab === value ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {TAB_LABEL[value]}
        </button>
      ))}
    </div>
  );
}

export function AdminPage() {
  const { hasPermission } = useAuth();
  // Each tab is gated on the permission its own data actually requires (role:manage for
  // GET /roles, user:manage for GET /users) — RequirePermission only guarantees the caller
  // holds at least one admin-scoped key, not necessarily the one a given tab needs, so showing
  // both tabs unconditionally would let a role:manage-only caller click into a Users tab that
  // 403s immediately.
  const availableTabs: AdminTab[] = [
    ...(hasPermission("role:manage") ? (["roles"] as const) : []),
    ...(hasPermission("user:manage") ? (["users"] as const) : []),
  ];

  const [requestedTab, setRequestedTab] = useState<AdminTab | null>(null);
  const activeTab =
    requestedTab && availableTabs.includes(requestedTab) ? requestedTab : (availableTabs[0] ?? null);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader active="admin" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin</h1>
          <p className="mt-1 text-sm text-muted">Manage roles, permissions, and user access.</p>
        </div>

        {activeTab !== null && availableTabs.length > 1 && (
          <AdminTabs tabs={availableTabs} tab={activeTab} onChange={setRequestedTab} />
        )}

        {activeTab === null && (
          <p className="text-sm text-muted">You don't have access to any admin sections.</p>
        )}

        {activeTab !== null && (
          <div id={`admin-panel-${activeTab}`} role="tabpanel" aria-labelledby={`admin-tab-${activeTab}`}>
            {activeTab === "roles" ? <RolesTab /> : <UsersTab />}
          </div>
        )}
      </main>
    </div>
  );
}
