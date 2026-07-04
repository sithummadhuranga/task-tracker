import { jest } from "@jest/globals";
import type {
  PermissionsRepository,
  PermissionSources,
} from "../../src/modules/rbac/permissions.repository.js";
import {
  PermissionsService,
  type PermissionsRedisClient,
} from "../../src/modules/rbac/permissions.service.js";

function createRepository(sources: PermissionSources) {
  const getPermissionSources = jest.fn(() => Promise.resolve(sources));
  const repository: PermissionsRepository = { getPermissionSources };
  return { repository, getPermissionSources };
}

function createRedis(cached: string[] = []): PermissionsRedisClient {
  return {
    smembers: jest.fn(() => Promise.resolve(cached)),
    sadd: jest.fn(() => Promise.resolve(1)),
    expire: jest.fn(() => Promise.resolve(1)),
    del: jest.fn(() => Promise.resolve(1)),
  };
}

describe("PermissionsService.resolveEffectivePermissions", () => {
  it("returns the cached set directly without touching the repository on a cache hit", async () => {
    const { repository, getPermissionSources } = createRepository({ roleKeys: [], overrides: [] });
    const redis = createRedis(["task:create", "task:read:own"]);
    const service = new PermissionsService(repository, redis);

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result.sort()).toEqual(["task:create", "task:read:own"]);
    expect(getPermissionSources).not.toHaveBeenCalled();
  });

  it("resolves to the union of role-derived permissions on a cache miss", async () => {
    const { repository } = createRepository({
      roleKeys: ["task:create", "task:read:own"],
      overrides: [],
    });
    const redis = createRedis();
    const service = new PermissionsService(repository, redis);

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result.sort()).toEqual(["task:create", "task:read:own"]);
  });

  it("adds a direct GRANT that isn't present via any role", async () => {
    const { repository } = createRepository({
      roleKeys: ["task:create"],
      overrides: [{ key: "role:manage", effect: "GRANT" }],
    });
    const service = new PermissionsService(repository, createRedis());

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result.sort()).toEqual(["role:manage", "task:create"]);
  });

  it("a direct DENY removes a permission that a role granted", async () => {
    const { repository } = createRepository({
      roleKeys: ["task:create", "task:read:own"],
      overrides: [{ key: "task:read:own", effect: "DENY" }],
    });
    const service = new PermissionsService(repository, createRedis());

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result).toEqual(["task:create"]);
  });

  it("DENY always wins over GRANT when both apply to the same key", async () => {
    const { repository } = createRepository({
      roleKeys: [],
      overrides: [
        { key: "user:manage", effect: "GRANT" },
        { key: "user:manage", effect: "DENY" },
      ],
    });
    const service = new PermissionsService(repository, createRedis());

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result).toEqual([]);
  });

  it("DENY wins even when the GRANT override is applied after it in the source list", async () => {
    const { repository } = createRepository({
      roleKeys: ["permission:assign"],
      overrides: [
        { key: "permission:assign", effect: "DENY" },
        { key: "permission:assign", effect: "GRANT" },
      ],
    });
    const service = new PermissionsService(repository, createRedis());

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result).toEqual([]);
  });

  it("caches a non-empty result with the 60s TTL", async () => {
    const { repository } = createRepository({ roleKeys: ["task:create"], overrides: [] });
    const redis = createRedis();
    const service = new PermissionsService(repository, redis);

    await service.resolveEffectivePermissions("user-1");

    expect(redis.sadd).toHaveBeenCalledWith("permissions:user-1", "task:create");
    expect(redis.expire).toHaveBeenCalledWith("permissions:user-1", 60);
  });

  it("caches a genuinely-empty result via a sentinel, so a zero-permission user still hits the cache", async () => {
    const { repository } = createRepository({ roleKeys: [], overrides: [] });
    const redis = createRedis();
    const service = new PermissionsService(repository, redis);

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result).toEqual([]);
    expect(redis.sadd).toHaveBeenCalledWith("permissions:user-1", "__EMPTY__");
    expect(redis.expire).toHaveBeenCalledWith("permissions:user-1", 60);
  });

  it("returns [] (not the sentinel) when the cached result is the empty marker", async () => {
    const { repository } = createRepository({ roleKeys: ["task:create"], overrides: [] });
    const redis = createRedis(["__EMPTY__"]);
    const service = new PermissionsService(repository, redis);

    const result = await service.resolveEffectivePermissions("user-1");

    expect(result).toEqual([]);
  });
});

describe("PermissionsService.addUserToRoleIndex", () => {
  it("adds the user to the role's reverse-index set", async () => {
    const redis = createRedis();
    const { repository } = createRepository({ roleKeys: [], overrides: [] });
    const service = new PermissionsService(repository, redis);

    await service.addUserToRoleIndex("user-1", "role-1");

    expect(redis.sadd).toHaveBeenCalledWith("role:role-1:users", "user-1");
  });
});

describe("PermissionsService.invalidateCacheForUser", () => {
  it("deletes the user's permission cache key", async () => {
    const redis = createRedis();
    const { repository } = createRepository({ roleKeys: [], overrides: [] });
    const service = new PermissionsService(repository, redis);

    await service.invalidateCacheForUser("user-1");

    expect(redis.del).toHaveBeenCalledWith("permissions:user-1");
  });
});
