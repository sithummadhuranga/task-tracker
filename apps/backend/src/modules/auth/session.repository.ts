import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import { redisClient } from "../../common/redis/client.js";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type SessionRedisClient = Pick<Redis, "get" | "set" | "sadd" | "srem" | "del" | "smembers" | "call">;

function sessionKey(token: string): string {
  return `session:${token}`;
}

// Reads the session value and, if it's still "active", flips it to "rotated" in the same
// server-side step. A plain GET followed by a separate SET leaves a window where two concurrent
// presenters of the same stolen token could both read "active" before either write the
// tombstone — defeating reuse detection under a race. Returns the value as it was *before* the
// tombstone write, so the caller can still tell "was active" from "was already rotated".
const READ_AND_TOMBSTONE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return false
end
local decoded = cjson.decode(raw)
if decoded.status == 'active' then
  decoded.status = 'rotated'
  redis.call('SET', KEYS[1], cjson.encode(decoded), 'KEEPTTL')
end
return raw
`;

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
    const raw = (await this.redis.call(
      "EVAL",
      READ_AND_TOMBSTONE_SCRIPT,
      "1",
      sessionKey(oldToken),
    )) as string | null;

    if (!raw) {
      return { status: "not_found" };
    }

    const parsed = JSON.parse(raw) as SessionValue;

    if (parsed.status === "rotated") {
      await this.revokeAllSessions(parsed.userId);
      return { status: "reuse_detected", userId: parsed.userId };
    }

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
