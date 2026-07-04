import type { Redis } from "ioredis";
import { redisClient } from "../../common/redis/client.js";
import { PrismaPermissionsRepository, type PermissionsRepository } from "./permissions.repository.js";

const CACHE_TTL_SECONDS = 60;

export type PermissionsRedisClient = Pick<Redis, "smembers" | "sadd" | "expire" | "del">;

function cacheKey(userId: string): string {
  return `permissions:${userId}`;
}

function roleIndexKey(roleId: string): string {
  return `role:${roleId}:users`;
}

export class PermissionsService {
  constructor(
    private readonly repository: PermissionsRepository = new PrismaPermissionsRepository(),
    private readonly redis: PermissionsRedisClient = redisClient,
  ) {}

  // Effective permissions = union(role permissions) + direct GRANT - direct DENY, DENY always
  // wins. A Redis Set can't represent a cached-but-empty result (an empty set has no key), so
  // a user whose effective permissions are genuinely empty never hits the cache — every
  // request recomputes from Postgres for that edge case, which is correct, just uncached.
  async resolveEffectivePermissions(userId: string): Promise<string[]> {
    const key = cacheKey(userId);
    const cached = await this.redis.smembers(key);

    if (cached.length > 0) {
      return cached;
    }

    const { roleKeys, overrides } = await this.repository.getPermissionSources(userId);
    const effective = new Set(roleKeys);

    for (const override of overrides) {
      if (override.effect === "GRANT") {
        effective.add(override.key);
      }
    }
    for (const override of overrides) {
      if (override.effect === "DENY") {
        effective.delete(override.key);
      }
    }

    const result = [...effective];

    if (result.length > 0) {
      await this.redis.sadd(key, ...result);
      await this.redis.expire(key, CACHE_TTL_SECONDS);
    }

    return result;
  }

  async invalidateCacheForUser(userId: string): Promise<void> {
    await this.redis.del(cacheKey(userId));
  }

  async addUserToRoleIndex(userId: string, roleId: string): Promise<void> {
    await this.redis.sadd(roleIndexKey(roleId), userId);
  }
}

export const permissionsService = new PermissionsService();
