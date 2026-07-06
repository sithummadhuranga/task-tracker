import type { RoleSummary } from "./admin.api";

interface RolesChecklistProps {
  roles: RoleSummary[];
  assignedNames: string[];
  isPending: boolean;
  onToggle: (roleId: string) => void;
}

export function RolesChecklist({ roles, assignedNames, isPending, onToggle }: RolesChecklistProps) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {roles.map((role) => (
        <li key={role.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span className="text-ink">{role.name}</span>
          <input
            type="checkbox"
            checked={assignedNames.includes(role.name)}
            disabled={isPending}
            onChange={() => {
              onToggle(role.id);
            }}
            aria-label={`Assign ${role.name}`}
            className="h-4 w-4 rounded border-border accent-primary disabled:cursor-not-allowed"
          />
        </li>
      ))}
    </ul>
  );
}
