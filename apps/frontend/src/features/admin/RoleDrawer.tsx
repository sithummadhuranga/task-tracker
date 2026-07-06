import type { PermissionKey } from "@task-tracker/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Drawer } from "../../components/ui/Drawer";
import { errorMessage } from "../../lib/errorMessage";
import {
  deleteRole,
  renameRole,
  replaceRolePermissions,
  type PermissionCatalogEntry,
  type RoleSummary,
} from "./admin.api";

interface RoleDrawerProps {
  role: RoleSummary | null;
  catalog: PermissionCatalogEntry[];
  onClose: () => void;
}

export function RoleDrawer({ role, catalog, onClose }: RoleDrawerProps) {
  const queryClient = useQueryClient();
  // Keeps rendering the last-open role's content while the drawer plays its close transition,
  // instead of blanking the panel the instant `role` becomes null.
  const [displayedRole, setDisplayedRole] = useState<RoleSummary | null>(role);
  const [name, setName] = useState(role?.name ?? "");
  const [selectedKeys, setSelectedKeys] = useState<Set<PermissionKey>>(
    new Set(role?.permissionKeys ?? []),
  );
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Adjusting state during render (React's documented alternative to a useEffect here) when a
  // new role object arrives as a prop — avoids the extra effect-triggered render pass.
  if (role && role !== displayedRole) {
    setDisplayedRole(role);
    setName(role.name);
    setSelectedKeys(new Set(role.permissionKeys));
  }

  function invalidateRoles(): void {
    void queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
  }

  const renameMutation = useMutation({
    mutationFn: (vars: { id: string; name: string }) => renameRole(vars.id, vars.name),
    onSuccess: () => {
      toast.success("Role renamed");
      invalidateRoles();
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const replacePermissionsMutation = useMutation({
    mutationFn: (vars: { id: string; permissionKeys: PermissionKey[] }) =>
      replaceRolePermissions(vars.id, vars.permissionKeys),
    onSuccess: () => {
      toast.success("Permissions updated");
      invalidateRoles();
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      toast.success("Role deleted");
      setIsDeleteConfirmOpen(false);
      onClose();
      invalidateRoles();
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
      setIsDeleteConfirmOpen(false);
    },
  });

  // Checkboxes apply immediately (each toggle submits the full replacement set right away) —
  // unlike the name field below, a discrete toggle reads more naturally as an instant action
  // than as a draft that needs an explicit Save.
  function toggleKey(key: PermissionKey): void {
    if (!displayedRole) {
      return;
    }

    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
    replacePermissionsMutation.mutate({ id: displayedRole.id, permissionKeys: [...next] });
  }

  const isSystem = displayedRole?.isSystem ?? false;
  const nameDirty = displayedRole !== null && name.trim().length > 0 && name.trim() !== displayedRole.name;

  return (
    <>
      <Drawer
        isOpen={role !== null}
        onClose={onClose}
        title={displayedRole ? `Manage ${displayedRole.name}` : "Manage role"}
        description={
          isSystem
            ? "System roles are protected — their name and permissions can't be changed here."
            : undefined
        }
      >
        {displayedRole && (
          <div className="space-y-6">
            <div>
              <label htmlFor="role-name" className="mb-1.5 block text-sm font-medium text-ink">
                Name
              </label>
              <div className="flex gap-2">
                <input
                  id="role-name"
                  value={name}
                  disabled={isSystem}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {!isSystem && (
                  <button
                    type="button"
                    disabled={!nameDirty || renameMutation.isPending}
                    onClick={() => {
                      renameMutation.mutate({ id: displayedRole.id, name: name.trim() });
                    }}
                    className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Permissions</h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {catalog.map((permission) => (
                  <li
                    key={permission.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <span className="font-mono text-xs text-ink">{permission.key}</span>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(permission.key)}
                      disabled={isSystem || replacePermissionsMutation.isPending}
                      onChange={() => {
                        toggleKey(permission.key);
                      }}
                      aria-label={`Grant ${permission.key}`}
                      className="h-4 w-4 rounded border-border accent-primary disabled:cursor-not-allowed"
                    />
                  </li>
                ))}
              </ul>
            </div>

            {!isSystem && (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
                <h3 className="text-sm font-medium text-ink">Danger zone</h3>
                <p className="mt-1 text-xs text-muted">
                  Deleting a role immediately revokes it from every user holding it.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="mt-3 rounded-lg bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
                >
                  Delete this role
                </button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title={`Delete ${displayedRole?.name ?? "role"}?`}
        description="This cannot be undone. Every user holding this role loses its permissions immediately."
        confirmLabel="Delete role"
        tone="danger"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => {
          if (displayedRole) {
            deleteMutation.mutate(displayedRole.id);
          }
        }}
        onCancel={() => {
          setIsDeleteConfirmOpen(false);
        }}
      />
    </>
  );
}
