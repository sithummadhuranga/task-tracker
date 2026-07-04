import { randomBytes } from "node:crypto";
import { redisClient } from "../../common/redis/client.js";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function sessionKey(token: string): string {
  return `session:${token}`;
}

function userSessionsKey(userId: string): string {
  return `user-sessions:${userId}`;
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

interface SessionValue {
  userId: string;
  status: "active" | "rotated";
}

export type RotateResult =
  | { status: "rotated"; userId: string; token: string }
  | { status: "reuse_detected"; userId: string }
  | { status: "not_found" };

export interface SessionRepository {
  createSession(userId: string): Promise<string>;
  rotateSession(oldToken: string): Promise<RotateResult>;
  revokeSession(token: string, userId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
}

export class RedisSessionRepository implements SessionRepository {
  async createSession(userId: string): Promise<string> {
    const token = generateToken();
    const value: SessionValue = { userId, status: "active" };

    await redisClient.set(sessionKey(token), JSON.stringify(value), "EX", SESSION_TTL_SECONDS);
    await redisClient.sadd(userSessionsKey(userId), token);

    return token;
  }

  // A rotated-out token isn't deleted outright — it's overwritten in place (keeping its
  // remaining TTL) with status "rotated". That's what lets a later replay of that exact same
  // token be recognized as reuse and traced back to a userId, rather than looking identical to
  // a token that never existed at all. Once its original 7-day TTL truly elapses, a replay of
  // that token is indistinguishable from garbage input — an unavoidable limit of a Redis
  // key-per-token model, not a gap in the detection logic itself.
  async rotateSession(oldToken: string): Promise<RotateResult> {
    const raw = await redisClient.get(sessionKey(oldToken));

    if (!raw) {
      return { status: "not_found" };
    }

    const parsed = JSON.parse(raw) as SessionValue;

    if (parsed.status === "rotated") {
      await this.revokeAllSessions(parsed.userId);
      return { status: "reuse_detected", userId: parsed.userId };
    }

    const tombstone: SessionValue = { userId: parsed.userId, status: "rotated" };
    await redisClient.set(sessionKey(oldToken), JSON.stringify(tombstone), "KEEPTTL");
    await redisClient.srem(userSessionsKey(parsed.userId), oldToken);

    const newToken = await this.createSession(parsed.userId);

    return { status: "rotated", userId: parsed.userId, token: newToken };
  }

  async revokeSession(token: string, userId: string): Promise<void> {
    await redisClient.del(sessionKey(token));
    await redisClient.srem(userSessionsKey(userId), token);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const tokens = await redisClient.smembers(userSessionsKey(userId));

    if (tokens.length > 0) {
      await redisClient.del(...tokens.map(sessionKey));
    }

    await redisClient.del(userSessionsKey(userId));
  }
}
