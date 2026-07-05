import { useState, type KeyboardEvent } from "react";
import { AppHeader } from "../../components/ui/AppHeader";
import { RolesTab } from "./RolesTab";
import { UsersTab } from "./UsersTab";

const TABS = ["roles", "users"] as const;
type AdminTab = (typeof TABS)[number];

const TAB_LABEL: Record<AdminTab, string> = {
  roles: "Roles",
  users: "Users",
};

function AdminTabs({ tab, onChange }: { tab: AdminTab; onChange: (tab: AdminTab) => void }) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : (index - 1 + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    if (next) {
      onChange(next);
    }
  }

  return (
    <div role="tablist" aria-label="Admin sections" className="mb-6 flex gap-1 border-b border-border">
      {TABS.map((value, index) => (
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
  const [tab, setTab] = useState<AdminTab>("roles");

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader active="admin" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin</h1>
          <p className="mt-1 text-sm text-muted">Manage roles, permissions, and user access.</p>
        </div>

        <AdminTabs tab={tab} onChange={setTab} />

        <div id={`admin-panel-${tab}`} role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
          {tab === "roles" ? <RolesTab /> : <UsersTab />}
        </div>
      </main>
    </div>
  );
}
