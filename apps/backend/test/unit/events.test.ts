import { jest } from "@jest/globals";
import type { TaskRecord } from "../../src/modules/tasks/tasks.repository.js";
import {
  TASK_READ_ANY_ROOM,
  TaskEventsEmitter,
  taskOwnerRoom,
  type TaskSocketServer,
} from "../../src/websocket/events.js";

function buildTask(): TaskRecord {
  return {
    id: "task-1",
    title: "Write report",
    description: null,
    status: "TODO",
    dueDate: new Date("2026-01-01T00:00:00.000Z"),
    ownerId: "owner-1",
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("TaskEventsEmitter", () => {
  it("is a no-op when no server has been attached (e.g. createApp() under supertest)", () => {
    const emitter = new TaskEventsEmitter();

    expect(() => {
      emitter.emit("task.created", buildTask());
    }).not.toThrow();
  });

  it("broadcasts to the owner's room and the task:read:any room once attached", () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ to, emit }));
    const emitter = new TaskEventsEmitter();
    emitter.attach({ to } as unknown as TaskSocketServer);

    const task = buildTask();
    emitter.emit("task.created", task);

    expect(to).toHaveBeenCalledWith(taskOwnerRoom("owner-1"));
    expect(to).toHaveBeenCalledWith(TASK_READ_ANY_ROOM);
    expect(emit).toHaveBeenCalledWith("task.created", { event: "task.created", task });
  });
});
