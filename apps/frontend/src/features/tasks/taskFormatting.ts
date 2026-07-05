import type { TaskStatus } from "@task-tracker/shared-types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  TODO: "bg-surface-2 text-muted",
  IN_PROGRESS: "bg-primary/15 text-primary",
  DONE: "bg-success/15 text-success",
};

// datetime-local inputs read/write local wall-clock time with no timezone suffix, so a stored
// UTC ISO instant is converted to local time for editing and back to a real ISO instant on
// submit — never treated as a bare date string.
export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string {
  return new Date(local).toISOString();
}

export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
