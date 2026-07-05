import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToTaskEvents } from "../../src/lib/socketClient";

const { socketMock, ioMock } = vi.hoisted(() => {
  const mock = { on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: false };
  return { socketMock: mock, ioMock: vi.fn(() => mock) };
});

vi.mock("socket.io-client", () => ({ io: ioMock }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("socketClient", () => {
  it("subscribes to all three task events plus connect, then unsubscribes on cleanup", () => {
    const onTaskEvent = vi.fn();
    const onReconnect = vi.fn();

    const unsubscribe = subscribeToTaskEvents(onTaskEvent, onReconnect);

    expect(socketMock.on).toHaveBeenCalledWith("task.created", expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith("task.updated", expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith("task.deleted", expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith("connect", onReconnect);
    expect(socketMock.connect).toHaveBeenCalled();

    unsubscribe();

    expect(socketMock.off).toHaveBeenCalledWith("task.created", expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith("task.updated", expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith("task.deleted", expect.any(Function));
    expect(socketMock.off).toHaveBeenCalledWith("connect", onReconnect);
  });

  it("extracts the task from either a {event, task} wrapper or a bare task object", () => {
    const onTaskEvent = vi.fn();
    subscribeToTaskEvents(onTaskEvent, vi.fn());

    const createdHandler = socketMock.on.mock.calls.find(([name]) => name === "task.created")?.[1] as (
      payload: unknown,
    ) => void;

    createdHandler({ event: "task.created", task: { id: "task-1" } });
    expect(onTaskEvent).toHaveBeenCalledWith({ id: "task-1" });

    createdHandler({ id: "task-2" });
    expect(onTaskEvent).toHaveBeenCalledWith({ id: "task-2" });
  });
});
