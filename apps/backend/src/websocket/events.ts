import type { DefaultEventsMap, Server, Socket } from "socket.io";
import type { TaskRecord } from "../modules/tasks/tasks.repository.js";

// Carried on each socket after handshake auth succeeds (see gateway.ts) — typed here, rather
// than left as the library's default `any`, so both gateway.ts and this emitter share one
// Server type without either side needing an unsafe cast to read or write socket.data.userId.
export interface TaskSocketData {
  userId: string;
}

export type TaskSocketServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  TaskSocketData
>;

export type TaskSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, TaskSocketData>;

export type TaskEventName = "task.created" | "task.updated" | "task.deleted";

export function taskOwnerRoom(ownerId: string): string {
  return `user:${ownerId}`;
}

export const TASK_READ_ANY_ROOM = "permission:task:read:any";

// Set once, from main.ts, once the real http.Server + Socket.io instance exist. createApp()
// itself (used directly by supertest in every e2e test) never has one, so emit() below is a
// deliberate no-op rather than a crash whenever this service runs outside main.ts.
export class TaskEventsEmitter {
  private io: TaskSocketServer | null = null;

  attach(server: TaskSocketServer): void {
    this.io = server;
  }

  emit(event: TaskEventName, task: TaskRecord): void {
    if (!this.io) {
      return;
    }

    this.io.to(taskOwnerRoom(task.ownerId)).to(TASK_READ_ANY_ROOM).emit(event, { event, task });
  }
}

export const taskEventsEmitter = new TaskEventsEmitter();
