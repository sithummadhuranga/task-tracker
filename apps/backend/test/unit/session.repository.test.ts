import type { SessionRedisClient } from "../../src/modules/auth/session.repository.js";
import { RedisSessionRepository } from "../../src/modules/auth/session.repository.js";

// A small in-memory double covering just the String/Set semantics this repository relies on —
// good enough to exercise real rotation/reuse-detection sequencing without a live Redis.
class FakeRedis {
  private readonly strings = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  set(key: string, value: string): Promise<"OK"> {
    this.strings.set(key, value);
    return Promise.resolve("OK");
  }

  sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    members.forEach((member) => set.add(member));
    this.sets.set(key, set);
    return Promise.resolve(members.length);
  }

  srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    members.forEach((member) => set?.delete(member));
    return Promise.resolve(members.length);
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.strings.delete(key)) removed += 1;
      if (this.sets.delete(key)) removed += 1;
    }
    return Promise.resolve(removed);
  }

  smembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? new Set())]);
  }
}

function createRepository() {
  return new RedisSessionRepository(new FakeRedis() as unknown as SessionRedisClient);
}

describe("RedisSessionRepository", () => {
  it("creates a session and lists it in the user's active sessions", async () => {
    const repository = createRepository();

    const token = await repository.createSession("user-1");

    expect(token).toEqual(expect.any(String));
  });

  it("rotates a valid session into a brand new token", async () => {
    const repository = createRepository();
    const token = await repository.createSession("user-1");

    const result = await repository.rotateSession(token);

    expect(result.status).toBe("rotated");
    if (result.status === "rotated") {
      expect(result.userId).toBe("user-1");
      expect(result.token).not.toBe(token);
    }
  });

  it("reports not_found for a token that was never issued", async () => {
    const repository = createRepository();

    const result = await repository.rotateSession("this-token-does-not-exist");

    expect(result).toEqual({ status: "not_found" });
  });

  it("detects reuse of an already-rotated token and revokes every session for that user", async () => {
    const repository = createRepository();
    const originalToken = await repository.createSession("user-1");
    const firstRotation = await repository.rotateSession(originalToken);
    expect(firstRotation.status).toBe("rotated");

    // Replaying the same (now-superseded) token is the theft signal.
    const reuseAttempt = await repository.rotateSession(originalToken);

    expect(reuseAttempt).toEqual({ status: "reuse_detected", userId: "user-1" });

    if (firstRotation.status === "rotated") {
      const followUp = await repository.rotateSession(firstRotation.token);
      expect(followUp).toEqual({ status: "not_found" });
    }
  });

  it("revokeSession removes only that one session", async () => {
    const repository = createRepository();
    const tokenA = await repository.createSession("user-1");
    const tokenB = await repository.createSession("user-1");

    await repository.revokeSession(tokenA, "user-1");

    const rotateA = await repository.rotateSession(tokenA);
    const rotateB = await repository.rotateSession(tokenB);

    expect(rotateA).toEqual({ status: "not_found" });
    expect(rotateB.status).toBe("rotated");
  });

  it("revokeAllSessions invalidates every session for the user", async () => {
    const repository = createRepository();
    const tokenA = await repository.createSession("user-1");
    const tokenB = await repository.createSession("user-1");

    await repository.revokeAllSessions("user-1");

    await expect(repository.rotateSession(tokenA)).resolves.toEqual({ status: "not_found" });
    await expect(repository.rotateSession(tokenB)).resolves.toEqual({ status: "not_found" });
  });

  it("revokeAllSessions is a no-op when the user has no active sessions", async () => {
    const repository = createRepository();

    await expect(repository.revokeAllSessions("user-with-no-sessions")).resolves.toBeUndefined();
  });
});
