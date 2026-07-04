import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import { redisClient } from "../../common/redis/client.js";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type SessionRedisClient = Pick<Redis, "get" | "set" | "sadd" | "srem" | "del" | "smembers">;

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
  constructor(private readonly redis: SessionRedisClient = redisClient) {}

  async createSession(userId: string): Promise<string> {
    const token = generateToken();
    const value: SessionValue = { userId, status: "active" };

    await this.redis.set(sessionKey(token), JSON.stringify(value), "EX", SESSION_TTL_SECONDS);
    await this.redis.sadd(userSessionsKey(userId), token);

    return token;
  }

  // A rotated-out token isn't deleted outright — it's overwritten in place (keeping its
  // remaining TTL) with status "rotated". That's what lets a later replay of that exact same
  // token be recognized as reuse and traced back to a userId, rather than looking identical to
  // a token that never existed at all. Once its original 7-day TTL truly elapses, a replay of
  // that token is indistinguishable from garbage input — an unavoidable limit of a Redis
  // key-per-token model, not a gap in the detection logic itself.
  async rotateSession(oldToken: string): Promise<RotateResult> {
    const raw = await this.redis.get(sessionKey(oldToken));

    if (!raw) {
      return { status: "not_found" };
    }

    const parsed = JSON.parse(raw) as SessionValue;

    if (parsed.status === "rotated") {
      await this.revokeAllSessions(parsed.userId);
      return { status: "reuse_detected", userId: parsed.userId };
    }

    const tombstone: SessionValue = { userId: parsed.userId, status: "rotated" };
    await this.redis.set(sessionKey(oldToken), JSON.stringify(tombstone), "KEEPTTL");
    await this.redis.srem(userSessionsKey(parsed.userId), oldToken);

    const newToken = await this.createSession(parsed.userId);

    return { status: "rotated", userId: parsed.userId, token: newToken };
  }

  async revokeSession(token: string, userId: string): Promise<void> {
    await this.redis.del(sessionKey(token));
    await this.redis.srem(userSessionsKey(userId), token);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const tokens = await this.redis.smembers(userSessionsKey(userId));

    if (tokens.length > 0) {
      await this.redis.del(...tokens.map(sessionKey));
    }

    await this.redis.del(userSessionsKey(userId));
  }
}
