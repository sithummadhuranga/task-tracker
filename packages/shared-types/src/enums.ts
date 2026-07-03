export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Exhaustive, code-defined catalog — not admin-creatable, only assignable to roles/users.
export const PERMISSION_KEYS = [
  "task:create",
  "task:read:own",
  "task:read:any",
  "task:update:own",
  "task:update:any",
  "task:delete:own",
  "task:delete:any",
  "role:manage",
  "user:manage",
  "permission:assign",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_EFFECTS = ["GRANT", "DENY"] as const;
export type PermissionEffect = (typeof PERMISSION_EFFECTS)[number];
