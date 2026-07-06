import type { PermissionKey } from "@task-tracker/shared-types";

export function hasPermission(granted: readonly string[], ...required: PermissionKey[]): boolean {
  return required.some((key) => granted.includes(key));
}
