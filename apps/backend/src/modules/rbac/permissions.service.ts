import type { Redis } from "ioredis";
import { redisClient } from "../../common/redis/client.js";
import {
  PrismaPermissionsRepository,
  type PermissionCatalogEntry,
  type PermissionsRepository,
} from "./permissions.repository.js";

const CACHE_TTL_SECONDS = 60;

// Not a valid permission key (real ones are always "resource:action" or "resource:action:scope"),
// so it can never collide with a real value — used to let a genuinely-empty result still occupy
// a Redis Set (an empty Set has no key at all, which would otherwise be indistinguishable from a
// cache miss and force every request for a zero-permission user to hit Postgres).
const EMPTY_RESULT_SENTINEL = "__EMPTY__";

export type PermissionsRedisClient = Pick<
  Redis,
  "smembers" | "sadd" | "srem" | "expire" | "del"
>;

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
  // wins.
  async resolveEffectivePermissions(userId: string): Promise<string[]> {
    const key = cacheKey(userId);
    const cached = await this.redis.smembers(key);

    if (cached.length > 0) {
      return cached.includes(EMPTY_RESULT_SENTINEL) ? [] : cached;
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

    await this.redis.sadd(key, ...(result.length > 0 ? result : [EMPTY_RESULT_SENTINEL]));
    await this.redis.expire(key, CACHE_TTL_SECONDS);

    return result;
  }

  async invalidateCacheForUser(userId: string): Promise<void> {
    await this.redis.del(cacheKey(userId));
  }

  async addUserToRoleIndex(userId: string, roleId: string): Promise<void> {
    await this.redis.sadd(roleIndexKey(roleId), userId);
  }

  async removeUserFromRoleIndex(userId: string, roleId: string): Promise<void> {
    await this.redis.srem(roleIndexKey(roleId), userId);
  }

  // Called whenever a role's permission set changes, so every user currently holding that role
  // sees the update on their next request instead of waiting out the 60s TTL.
  async invalidateCacheForRole(roleId: string): Promise<void> {
    const userIds = await this.redis.smembers(roleIndexKey(roleId));

    if (userIds.length > 0) {
      await this.redis.del(...userIds.map(cacheKey));
    }
  }

  // Distinct from invalidateCacheForRole: only called when the role itself is deleted, to drop
  // the now-meaningless index set rather than leaving it to point at a role that no longer exists.
  async deleteRoleIndex(roleId: string): Promise<void> {
    await this.redis.del(roleIndexKey(roleId));
  }

  async listCatalog(): Promise<PermissionCatalogEntry[]> {
    return this.repository.listCatalog();
  }
}

export const permissionsService = new PermissionsService();
