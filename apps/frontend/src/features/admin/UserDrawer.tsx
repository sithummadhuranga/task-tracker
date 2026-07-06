import type { PermissionEffect, PermissionKey } from "@task-tracker/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Drawer } from "../../components/ui/Drawer";
import { errorMessage } from "../../lib/errorMessage";
import { AddOverrideForm } from "./AddOverrideForm";
import {
  assignUserRoles,
  deletePermissionOverride,
  fetchPermissionCatalog,
  fetchRoles,
  fetchUserDetail,
  logoutAllForUser,
  upsertPermissionOverride,
  type UserDetail,
} from "./admin.api";
import { PermissionOverridesList } from "./PermissionOverridesList";
import { RolesChecklist } from "./RolesChecklist";

interface UserDrawerProps {
  userId: string | null;
  onClose: () => void;
}

interface DisplayedUser {
  userId: string;
  detail: UserDetail;
}

export function UserDrawer({ userId, onClose }: UserDrawerProps) {
  const queryClient = useQueryClient();
  const [displayed, setDisplayed] = useState<DisplayedUser | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin", "users", "detail", userId],
    queryFn: () => {
      if (!userId) {
        return Promise.reject(new Error("no user selected"));
      }
      return fetchUserDetail(userId);
    },
    enabled: userId !== null,
  });
  const rolesQuery = useQuery({ queryKey: ["admin", "roles"], queryFn: fetchRoles });
  const catalogQuery = useQuery({ queryKey: ["admin", "permissions"], queryFn: fetchPermissionCatalog });

  // Adjusting state during render (React's documented alternative to a useEffect here) rather
  // than syncing via an effect. Two cases: switching directly to a different user clears the
  // stale content immediately (don't show user A's data under user B's drawer); once fresh
  // detail is available for the current user, it becomes the displayed content — compared by
  // reference (not just userId) so a refetch after a mutation invalidates this query (assign
  // role, add/remove an override) replaces the stale snapshot too, not only on user switch.
  // Closing (userId → null) hits neither branch, so the last displayed content keeps rendering
  // through the close transition.
  if (userId !== null && displayed !== null && displayed.userId !== userId) {
    setDisplayed(null);
  } else if (userId !== null && detailQuery.data && detailQuery.data !== displayed?.detail) {
    setDisplayed({ userId, detail: detailQuery.data });
  }

  function invalidateUser(id: string): void {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users", "detail", id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const assignRolesMutation = useMutation({
    mutationFn: (vars: { userId: string; roleIds: string[] }) =>
      assignUserRoles(vars.userId, vars.roleIds),
    onSuccess: (_data, vars) => {
      toast.success("Roles updated");
      invalidateUser(vars.userId);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const upsertOverrideMutation = useMutation({
    mutationFn: (vars: { userId: string; permissionKey: PermissionKey; effect: PermissionEffect }) =>
      upsertPermissionOverride(vars.userId, vars.permissionKey, vars.effect),
    onSuccess: (_data, vars) => {
      toast.success("Override saved");
      invalidateUser(vars.userId);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: (vars: { userId: string; overrideId: string }) =>
      deletePermissionOverride(vars.userId, vars.overrideId),
    onSuccess: (_data, vars) => {
      toast.success("Override removed");
      invalidateUser(vars.userId);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: (id: string) => logoutAllForUser(id),
    onSuccess: () => {
      toast.success("All sessions revoked");
      setIsLogoutConfirmOpen(false);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
      setIsLogoutConfirmOpen(false);
    },
  });

  function toggleRole(roleId: string): void {
    if (!displayed) {
      return;
    }

    const roles = rolesQuery.data ?? [];
    const currentIds = roles
      .filter((role) => displayed.detail.roles.includes(role.name))
      .map((role) => role.id);
    const next = currentIds.includes(roleId)
      ? currentIds.filter((id) => id !== roleId)
      : [...currentIds, roleId];

    assignRolesMutation.mutate({ userId: displayed.userId, roleIds: next });
  }

  const roles = rolesQuery.data ?? [];
  const catalog = catalogQuery.data ?? [];
  const overriddenKeys = new Set(displayed?.detail.overrides.map((override) => override.permissionKey) ?? []);
  const availableKeys = catalog.map((entry) => entry.key).filter((key) => !overriddenKeys.has(key));

  return (
    <>
      <Drawer
        isOpen={userId !== null}
        onClose={onClose}
        title={displayed ? displayed.detail.user.name : "User detail"}
        description={displayed?.detail.user.email}
      >
        {displayed && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Roles</h3>
              <RolesChecklist
                roles={roles}
                assignedNames={displayed.detail.roles}
                isPending={assignRolesMutation.isPending}
                onToggle={toggleRole}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Direct permission overrides</h3>
              <PermissionOverridesList
                overrides={displayed.detail.overrides}
                isRemoving={deleteOverrideMutation.isPending}
                onRemove={(overrideId) => {
                  deleteOverrideMutation.mutate({ userId: displayed.userId, overrideId });
                }}
              />
              <AddOverrideForm
                availableKeys={availableKeys}
                isPending={upsertOverrideMutation.isPending}
                onAdd={(key, effect) => {
                  upsertOverrideMutation.mutate({ userId: displayed.userId, permissionKey: key, effect });
                }}
              />
            </div>

            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <h3 className="text-sm font-medium text-ink">Danger zone</h3>
              <p className="mt-1 text-xs text-muted">
                Forces this user out of every device immediately — they'll need to sign in again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(true);
                }}
                className="mt-3 rounded-lg bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
              >
                Force logout everywhere
              </button>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        title="Force logout everywhere?"
        description="Every active session for this user is revoked immediately. They'll be signed out on all devices."
        confirmLabel="Force logout"
        tone="danger"
        isConfirming={logoutAllMutation.isPending}
        onConfirm={() => {
          if (displayed) {
            logoutAllMutation.mutate(displayed.userId);
          }
        }}
        onCancel={() => {
          setIsLogoutConfirmOpen(false);
        }}
      />
    </>
  );
}
