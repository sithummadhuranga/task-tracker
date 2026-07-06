import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { env } from "../../src/common/config/env.js";
import { TASK_READ_ANY_ROOM, taskOwnerRoom, type TaskSocketServer } from "../../src/websocket/events.js";
import {
  registerSocketGateway,
  SocketSessionGateway,
  type SocketPermissionsResolver,
} from "../../src/websocket/gateway.js";

type SocketMiddleware = (socket: FakeSocket, next: (error?: Error) => void) => void;
type ConnectionHandler = (socket: FakeSocket) => void;

interface FakeSocket {
  handshake: { auth: Record<string, unknown> };
  data: { userId?: string };
  join: jest.Mock<(room: string) => Promise<void>>;
  disconnect: jest.Mock<(close?: boolean) => FakeSocket>;
}

function buildFakeSocket(auth: Record<string, unknown>): FakeSocket {
  return {
    handshake: { auth },
    data: {},
    join: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(function (this: FakeSocket) {
      return this;
    }),
  };
}

interface FakeServer {
  use: jest.Mock<(middleware: SocketMiddleware) => void>;
  on: jest.Mock<(event: string, handler: ConnectionHandler) => void>;
}

function buildFakeServer(): FakeServer {
  return { use: jest.fn(), on: jest.fn() };
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

function buildPermissions(keys: string[]): SocketPermissionsResolver {
  return {
    resolveEffectivePermissions: jest.fn<SocketPermissionsResolver["resolveEffectivePermissions"]>(
      () => Promise.resolve(keys),
    ),
  };
}

function getRegisteredMiddleware(server: FakeServer): SocketMiddleware {
  const call = server.use.mock.calls[0];
  if (!call) {
    throw new Error("expected io.use to have registered a middleware");
  }
  return call[0];
}

function getRegisteredConnectionHandler(server: FakeServer): ConnectionHandler {
  const call = server.on.mock.calls.find(([event]) => event === "connection");
  if (!call) {
    throw new Error("expected io.on('connection', ...) to have been registered");
  }
  return call[1];
}

describe("registerSocketGateway handshake auth", () => {
  it("rejects a handshake with no token", () => {
    const server = buildFakeServer();
    registerSocketGateway(server as unknown as TaskSocketServer, buildPermissions([]));
    const middleware = getRegisteredMiddleware(server);
    const next = jest.fn();

    middleware(buildFakeSocket({}), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rejects a handshake with an invalid token", () => {
    const server = buildFakeServer();
    registerSocketGateway(server as unknown as TaskSocketServer, buildPermissions([]));
    const middleware = getRegisteredMiddleware(server);
    const next = jest.fn();

    middleware(buildFakeSocket({ token: "not-a-real-token" }), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("accepts a valid access token and stores the userId on socket.data", () => {
    const server = buildFakeServer();
    registerSocketGateway(server as unknown as TaskSocketServer, buildPermissions([]));
    const middleware = getRegisteredMiddleware(server);
    const next = jest.fn();
    const socket = buildFakeSocket({ token: signAccessToken("user-1") });

    middleware(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.userId).toBe("user-1");
  });
});

describe("registerSocketGateway room join on connection", () => {
  it("always joins the user's own room", async () => {
    const server = buildFakeServer();
    registerSocketGateway(server as unknown as TaskSocketServer, buildPermissions([]));
    const handler = getRegisteredConnectionHandler(server);
    const socket = buildFakeSocket({});
    socket.data.userId = "user-1";

    handler(socket);
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.join).toHaveBeenCalledWith(taskOwnerRoom("user-1"));
  });

  it("joins the task:read:any room when the user holds that permission", async () => {
    const server = buildFakeServer();
    registerSocketGateway(server as unknown as TaskSocketServer, buildPermissions(["task:read:any"]));
    const handler = getRegisteredConnectionHandler(server);
    const socket = buildFakeSocket({});
    socket.data.userId = "user-1";

    handler(socket);
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.join).toHaveBeenCalledWith(TASK_READ_ANY_ROOM);
  });

  it("does not join the task:read:any room without that permission", async () => {
    const server = buildFakeServer();
    registerSocketGateway(server as unknown as TaskSocketServer, buildPermissions(["task:create"]));
    const handler = getRegisteredConnectionHandler(server);
    const socket = buildFakeSocket({});
    socket.data.userId = "user-1";

    handler(socket);
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.join).not.toHaveBeenCalledWith(TASK_READ_ANY_ROOM);
  });

  it("disconnects the socket if joining rooms fails, instead of leaving it silently in none", async () => {
    const server = buildFakeServer();
    const permissions: SocketPermissionsResolver = {
      resolveEffectivePermissions: jest.fn<SocketPermissionsResolver["resolveEffectivePermissions"]>(
        () => Promise.reject(new Error("redis unavailable")),
      ),
    };
    registerSocketGateway(server as unknown as TaskSocketServer, permissions);
    const handler = getRegisteredConnectionHandler(server);
    const socket = buildFakeSocket({});
    socket.data.userId = "user-1";

    handler(socket);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});

describe("SocketSessionGateway.disconnectUser", () => {
  it("force-disconnects every socket in the user's room once attached", () => {
    const disconnectSockets = jest.fn();
    const inRoom = jest.fn(() => ({ disconnectSockets }));
    const server = { in: inRoom };
    const gateway = new SocketSessionGateway();

    gateway.attach(server as unknown as TaskSocketServer);
    gateway.disconnectUser("user-1");

    expect(inRoom).toHaveBeenCalledWith(taskOwnerRoom("user-1"));
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });

  it("is a no-op when no server has been attached yet", () => {
    const gateway = new SocketSessionGateway();

    expect(() => {
      gateway.disconnectUser("user-1");
    }).not.toThrow();
  });
});
