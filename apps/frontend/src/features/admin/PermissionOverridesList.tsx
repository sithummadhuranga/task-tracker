import { X } from "lucide-react";
import type { PermissionOverride } from "./admin.api";

interface PermissionOverridesListProps {
  overrides: PermissionOverride[];
  isRemoving: boolean;
  onRemove: (overrideId: string) => void;
}

export function PermissionOverridesList({
  overrides,
  isRemoving,
  onRemove,
}: PermissionOverridesListProps) {
  return (
    <ul className="mb-3 divide-y divide-border rounded-xl border border-border">
      {overrides.length === 0 && (
        <li className="px-3.5 py-4 text-sm text-muted">
          No direct overrides — this user's permissions come entirely from their roles.
        </li>
      )}
      {overrides.map((override) => (
        <li key={override.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                override.effect === "GRANT" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              }`}
            >
              {override.effect === "GRANT" ? "Grant" : "Deny"}
            </span>
            <span className="font-mono text-xs text-ink">{override.permissionKey}</span>
          </div>
          <button
            type="button"
            disabled={isRemoving}
            onClick={() => {
              onRemove(override.id);
            }}
            aria-label={`Remove override for ${override.permissionKey}`}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:cursor-not-allowed"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
