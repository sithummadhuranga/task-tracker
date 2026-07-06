import jwt from "jsonwebtoken";
import { env } from "../common/config/env.js";
import { logger } from "../common/logging/logger.js";
import { permissionsService, type PermissionsService } from "../modules/rbac/permissions.service.js";
import {
  TASK_READ_ANY_ROOM,
  taskOwnerRoom,
  type TaskSocket,
  type TaskSocketServer,
} from "./events.js";

// Access tokens are verified only once, at handshake — a live connection otherwise outlives a
// revoked session for up to the token's remaining 15-minute lifetime, still receiving task
// events. logout-all calls disconnectUser() right after revoking sessions so a forced logout
// takes effect on open sockets immediately, not just on the caller's next HTTP request.
export class SocketSessionGateway {
  private io: TaskSocketServer | null = null;

  attach(server: TaskSocketServer): void {
    this.io = server;
  }

  disconnectUser(userId: string): void {
    this.io?.in(taskOwnerRoom(userId)).disconnectSockets(true);
  }
}

export const socketSessionGateway = new SocketSessionGateway();

export type SocketPermissionsResolver = Pick<PermissionsService, "resolveEffectivePermissions">;

interface HandshakeAuth {
  token?: unknown;
}

// Mirrors authenticate.ts's verification exactly (same secret, same { sub: userId } payload
// shape) — the handshake carries the identical access token issued by /auth/login, just over
// a different transport, so it must be checked the same way rather than reinvented here.
function verifyAccessToken(token: unknown): string {
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("missing access token");
  }

  let payload: string | jwt.JwtPayload;

  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new Error("invalid or expired access token");
  }

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new Error("invalid access token");
  }

  return payload.sub;
}

async function joinRooms(socket: TaskSocket, permissions: SocketPermissionsResolver): Promise<void> {
  const { userId } = socket.data;
  await socket.join(taskOwnerRoom(userId));

  const effectivePermissions = await permissions.resolveEffectivePermissions(userId);

  if (effectivePermissions.includes("task:read:any")) {
    await socket.join(TASK_READ_ANY_ROOM);
  }
}

export function registerSocketGateway(
  io: TaskSocketServer,
  permissions: SocketPermissionsResolver = permissionsService,
): void {
  io.use((socket, next) => {
    try {
      const auth = socket.handshake.auth as HandshakeAuth;
      socket.data.userId = verifyAccessToken(auth.token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    joinRooms(socket, permissions).catch((error: unknown) => {
      logger.error({ err: error, userId: socket.data.userId }, "failed to join task rooms for socket");
      // Left connected with no rooms joined, a socket would silently never receive task events
      // again — disconnecting surfaces the failure to the client instead (its socket.io client
      // reconnect logic then retries joinRooms fresh on the next handshake).
      socket.disconnect(true);
    });
  });
}
