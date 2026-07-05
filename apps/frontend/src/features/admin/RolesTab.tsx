import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { InlineError } from "../../components/ui/InlineError";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { errorMessage } from "../../lib/errorMessage";
import { createRole, fetchPermissionCatalog, fetchRoles, type RoleSummary } from "./admin.api";
import { RoleDrawer } from "./RoleDrawer";

function CreateRoleForm({ onCreate, isPending }: { onCreate: (name: string) => void; isPending: boolean }) {
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed) {
          onCreate(trimmed);
          setName("");
        }
      }}
      className="flex items-end gap-3"
    >
      <div className="w-full max-w-xs">
        <label htmlFor="new-role-name" className="mb-1.5 block text-sm font-medium text-ink">
          New role
        </label>
        <input
          id="new-role-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="e.g. Editor"
          disabled={isPending}
          className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        Create role
      </button>
    </form>
  );
}

export function RolesTab() {
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = useState<RoleSummary | null>(null);

  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: fetchRoles });
  const catalogQuery = useQuery({ queryKey: ["admin", "permissions"], queryFn: fetchPermissionCatalog });

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      toast.success("Role created");
      void queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  if (rolesQuery.isPending || catalogQuery.isPending) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-full max-w-xs animate-pulse rounded-xl bg-surface-2" />
        <TableSkeleton rows={4} columns={3} />
      </div>
    );
  }

  if (rolesQuery.isError || catalogQuery.isError) {
    return (
      <InlineError
        message="Couldn't load roles."
        onRetry={() => {
          void rolesQuery.refetch();
          void catalogQuery.refetch();
        }}
      />
    );
  }

  const roles = rolesQuery.data;
  const catalog = catalogQuery.data;

  // Keeps the open drawer in sync after a mutation invalidates and refetches this list (e.g.
  // renaming the active role) — without this, activeRole stays the stale pre-mutation snapshot
  // until the drawer is closed and reopened.
  if (activeRole) {
    const fresh = roles.find((role) => role.id === activeRole.id);
    if (fresh && fresh !== activeRole) {
      setActiveRole(fresh);
    }
  }

  return (
    <div className="space-y-6">
      <CreateRoleForm
        onCreate={(name) => {
          createMutation.mutate(name);
        }}
        isPending={createMutation.isPending}
      />

      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
            <th className="border-b border-border py-2.5 pr-4 font-medium">Name</th>
            <th className="border-b border-border py-2.5 pr-4 font-medium">Permissions</th>
            <th className="border-b border-border py-2.5 pr-4 font-medium" />
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id} className="group">
              <td className="border-b border-border py-3 pr-4 align-middle">
                <span className="font-medium text-ink">{role.name}</span>
                {role.isSystem && (
                  <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                    System
                  </span>
                )}
              </td>
              <td className="border-b border-border py-3 pr-4 align-middle text-muted">
                {role.permissionKeys.length} of {catalog.length}
              </td>
              <td className="border-b border-border py-3 pr-4 text-right align-middle">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRole(role);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  Manage
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <RoleDrawer
        role={activeRole}
        catalog={catalog}
        onClose={() => {
          setActiveRole(null);
        }}
      />
    </div>
  );
}
