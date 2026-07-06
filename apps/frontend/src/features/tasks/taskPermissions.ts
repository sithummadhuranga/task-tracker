import type { PermissionKey } from "@task-tracker/shared-types";
import type { Task } from "./tasks.api";

export type HasPermission = (...keys: PermissionKey[]) => boolean;

export function canEditTask(task: Task, currentUserId: string | undefined, hasPermission: HasPermission): boolean {
  const isOwner = task.ownerId === currentUserId;
  return hasPermission("task:update:any") || (isOwner && hasPermission("task:update:own"));
}

export function canDeleteTask(task: Task, currentUserId: string | undefined, hasPermission: HasPermission): boolean {
  const isOwner = task.ownerId === currentUserId;
  return hasPermission("task:delete:any") || (isOwner && hasPermission("task:delete:own"));
}
