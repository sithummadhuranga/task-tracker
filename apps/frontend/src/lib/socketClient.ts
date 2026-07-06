import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./apiClient";

const TASK_EVENT_NAMES = ["task.created", "task.updated", "task.deleted"] as const;

export interface TaskEventTask {
  id: string;
  [key: string]: unknown;
}

let socket: Socket | null = null;

function getSocket(): Socket {
  // `auth` as a callback (rather than a plain object) is read fresh on every (re)connect
  // attempt, so a token obtained after the socket module first loaded — or rotated since the
  // last connection — is always the one presented at handshake time.
  socket ??= io(import.meta.env.VITE_API_URL, {
    autoConnect: false,
    auth: (callback) => {
      callback({ token: getAccessToken() });
    },
  });
  return socket;
}

export function connectTaskSocket(): Socket {
  const instance = getSocket();
  if (!instance.connected) {
    instance.connect();
  }
  return instance;
}

export function disconnectTaskSocket(): void {
  socket?.disconnect();
}

// docs/FEATURES_AND_API.md §6 documents the wire payload as `{ event, task }`, but also names
// this exact ambiguity: the backend may instead pass the bare task object directly, since the
// Socket.io event name (`task.created`, etc.) already encodes what `event` would say. Handling
// both shapes here is the one place this client adapts defensively rather than assuming.
function extractTask(payload: unknown): TaskEventTask | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = "task" in payload ? payload.task : payload;
  if (candidate && typeof candidate === "object" && "id" in candidate) {
    return candidate as TaskEventTask;
  }
  return null;
}

export function subscribeToTaskEvents(
  onTaskEvent: (task: TaskEventTask) => void,
  onReconnect: () => void,
): () => void {
  const instance = connectTaskSocket();

  function handleEvent(payload: unknown): void {
    const task = extractTask(payload);
    if (task) {
      onTaskEvent(task);
    }
  }

  TASK_EVENT_NAMES.forEach((name) => {
    instance.on(name, handleEvent);
  });
  instance.on("connect", onReconnect);

  return () => {
    TASK_EVENT_NAMES.forEach((name) => {
      instance.off(name, handleEvent);
    });
    instance.off("connect", onReconnect);
  };
}
