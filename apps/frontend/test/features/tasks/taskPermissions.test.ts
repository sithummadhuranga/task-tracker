import { describe, expect, it, vi } from "vitest";
import { canDeleteTask, canEditTask } from "../../../src/features/tasks/taskPermissions";
import type { Task } from "../../../src/features/tasks/tasks.api";

const TASK: Task = {
  id: "task-1",
  title: "Write report",
  status: "TODO",
  dueDate: "2026-08-01T00:00:00.000Z",
  ownerId: "owner-1",
  version: 1,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function hasPermissionFn(...granted: string[]) {
  return vi.fn((...keys: string[]) => keys.some((key) => granted.includes(key)));
}

describe("canEditTask", () => {
  it("allows a caller with task:update:any regardless of ownership", () => {
    expect(canEditTask(TASK, "someone-else", hasPermissionFn("task:update:any"))).toBe(true);
  });

  it("allows the owner with task:update:own", () => {
    expect(canEditTask(TASK, "owner-1", hasPermissionFn("task:update:own"))).toBe(true);
  });

  it("rejects a non-owner with only task:update:own", () => {
    expect(canEditTask(TASK, "someone-else", hasPermissionFn("task:update:own"))).toBe(false);
  });

  it("rejects a caller with no relevant permission", () => {
    expect(canEditTask(TASK, "owner-1", hasPermissionFn())).toBe(false);
  });
});

describe("canDeleteTask", () => {
  it("allows a caller with task:delete:any regardless of ownership", () => {
    expect(canDeleteTask(TASK, "someone-else", hasPermissionFn("task:delete:any"))).toBe(true);
  });

  it("allows the owner with task:delete:own", () => {
    expect(canDeleteTask(TASK, "owner-1", hasPermissionFn("task:delete:own"))).toBe(true);
  });

  it("rejects a non-owner with only task:delete:own", () => {
    expect(canDeleteTask(TASK, "someone-else", hasPermissionFn("task:delete:own"))).toBe(false);
  });

  it("rejects a caller with no relevant permission", () => {
    expect(canDeleteTask(TASK, "owner-1", hasPermissionFn())).toBe(false);
  });
});
