import { jest } from "@jest/globals";
import { NotFoundError } from "../../src/common/errors/index.js";
import type { SessionRepository } from "../../src/modules/auth/session.repository.js";
import type {
  CacheInvalidator,
  LogoutSessionRepository,
} from "../../src/modules/users/users.service.js";
import { UsersService } from "../../src/modules/users/users.service.js";
import type {
  PaginatedUsers,
  UserLookupRecord,
  UserRecord,
  UsersRepository,
  UserWithOverrides,
} from "../../src/modules/users/users.repository.js";

function toDetailResult(record: UserWithOverrides) {
  return {
    user: {
      id: record.id,
      email: record.email,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    roles: record.roles,
    overrides: record.overrides,
  };
}

const NOW = new Date("2026-01-01T00:00:00.000Z");

function buildUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "user-1",
    email: "jane@example.com",
    passwordHash: "",
    name: "Jane Doe",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

interface UsersRepositoryMocks {
  repository: UsersRepository;
  findById: jest.Mock<UsersRepository["findById"]>;
  findManyPaginated: jest.Mock<UsersRepository["findManyPaginated"]>;
  findByIdWithOverrides: jest.Mock<UsersRepository["findByIdWithOverrides"]>;
  upsertPermissionOverride: jest.Mock<UsersRepository["upsertPermissionOverride"]>;
  deletePermissionOverride: jest.Mock<UsersRepository["deletePermissionOverride"]>;
  findManyByIds: jest.Mock<UsersRepository["findManyByIds"]>;
  searchByText: jest.Mock<UsersRepository["searchByText"]>;
}

function createUsersRepository(): UsersRepositoryMocks {
  const findByEmail = jest.fn<UsersRepository["findByEmail"]>(() => Promise.resolve(null));
  const findById = jest.fn<UsersRepository["findById"]>(() => Promise.resolve(buildUser()));
  const findByIdWithRoles = jest.fn<UsersRepository["findByIdWithRoles"]>(() =>
    Promise.resolve(null),
  );
  const createWithDefaultRole = jest.fn<UsersRepository["createWithDefaultRole"]>((input) =>
    Promise.resolve({ user: buildUser(input), roleId: "role-user" }),
  );
  const findManyPaginated = jest.fn<UsersRepository["findManyPaginated"]>(() =>
    Promise.resolve({ users: [], total: 0 } satisfies PaginatedUsers),
  );
  const findByIdWithOverrides = jest.fn<UsersRepository["findByIdWithOverrides"]>(() =>
    Promise.resolve({ ...buildUser(), roles: ["USER"], overrides: [] } satisfies UserWithOverrides),
  );
  const replaceRoles = jest.fn<UsersRepository["replaceRoles"]>(() =>
    Promise.resolve({ added: [], removed: [] }),
  );
  const upsertPermissionOverride = jest.fn<UsersRepository["upsertPermissionOverride"]>(() =>
    Promise.resolve(),
  );
  const deletePermissionOverride = jest.fn<UsersRepository["deletePermissionOverride"]>(() =>
    Promise.resolve(true),
  );
  const findManyByIds = jest.fn<UsersRepository["findManyByIds"]>(() => Promise.resolve([]));
  const searchByText = jest.fn<UsersRepository["searchByText"]>(() => Promise.resolve([]));

  return {
    repository: {
      findByEmail,
      findById,
      findByIdWithRoles,
      createWithDefaultRole,
      findManyPaginated,
      findByIdWithOverrides,
      replaceRoles,
      upsertPermissionOverride,
      deletePermissionOverride,
      findManyByIds,
      searchByText,
    },
    findById,
    findManyPaginated,
    findByIdWithOverrides,
    upsertPermissionOverride,
    deletePermissionOverride,
    findManyByIds,
    searchByText,
  };
}

interface SessionRepositoryMocks {
  repository: LogoutSessionRepository;
  revokeAllSessions: jest.Mock<SessionRepository["revokeAllSessions"]>;
}

function createSessionRepository(): SessionRepositoryMocks {
  const revokeAllSessions = jest.fn<SessionRepository["revokeAllSessions"]>(() =>
    Promise.resolve(),
  );
  return { repository: { revokeAllSessions }, revokeAllSessions };
}

interface PermissionsMocks {
  permissions: CacheInvalidator;
  invalidateCacheForUser: jest.Mock<CacheInvalidator["invalidateCacheForUser"]>;
}

function createPermissions(): PermissionsMocks {
  const invalidateCacheForUser = jest.fn<CacheInvalidator["invalidateCacheForUser"]>(() =>
    Promise.resolve(),
  );
  return { permissions: { invalidateCacheForUser }, invalidateCacheForUser };
}

function buildService(
  users: UsersRepositoryMocks = createUsersRepository(),
  sessions: SessionRepositoryMocks = createSessionRepository(),
  permissions: PermissionsMocks = createPermissions(),
): UsersService {
  return new UsersService(users.repository, sessions.repository, permissions.permissions);
}

describe("UsersService.listUsers", () => {
  it("returns the paginated result from the repository without leaking passwordHash", async () => {
    const users = createUsersRepository();
    users.findManyPaginated.mockResolvedValue({
      users: [{ ...buildUser(), roles: ["USER"] }],
      total: 1,
    });

    const result = await buildService(users).listUsers({ page: 1, limit: 10 });

    expect(result).toEqual({
      users: [
        {
          id: "user-1",
          email: "jane@example.com",
          name: "Jane Doe",
          createdAt: NOW,
          updatedAt: NOW,
          roles: ["USER"],
        },
      ],
      total: 1,
    });
    expect(users.findManyPaginated).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });
});

describe("UsersService.getUserDetail", () => {
  it("throws NotFoundError for a missing user", async () => {
    const users = createUsersRepository();
    users.findByIdWithOverrides.mockResolvedValue(null);

    await expect(buildService(users).getUserDetail("ghost")).rejects.toThrow(NotFoundError);
  });

  it("returns roles and overrides together, without leaking passwordHash", async () => {
    const detail: UserWithOverrides = {
      ...buildUser(),
      roles: ["USER"],
      overrides: [{ id: "override-1", permissionKey: "task:create", effect: "GRANT" }],
    };
    const users = createUsersRepository();
    users.findByIdWithOverrides.mockResolvedValue(detail);

    const result = await buildService(users).getUserDetail("user-1");

    expect(result).toEqual(toDetailResult(detail));
    expect(result.user).not.toHaveProperty("passwordHash");
  });
});

describe("UsersService.upsertPermissionOverride", () => {
  it("throws NotFoundError for a missing user", async () => {
    const users = createUsersRepository();
    users.findById.mockResolvedValue(null);

    await expect(
      buildService(users).upsertPermissionOverride("ghost", {
        permissionKey: "task:create",
        effect: "GRANT",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("upserts the override and invalidates the user's cache once", async () => {
    const users = createUsersRepository();
    const permissions = createPermissions();

    await buildService(users, createSessionRepository(), permissions).upsertPermissionOverride(
      "user-1",
      { permissionKey: "task:create", effect: "DENY" },
    );

    expect(users.upsertPermissionOverride).toHaveBeenCalledWith("user-1", "task:create", "DENY");
    expect(permissions.invalidateCacheForUser).toHaveBeenCalledTimes(1);
    expect(permissions.invalidateCacheForUser).toHaveBeenCalledWith("user-1");
  });
});

describe("UsersService.deletePermissionOverride", () => {
  it("throws NotFoundError when the override doesn't exist", async () => {
    const users = createUsersRepository();
    users.deletePermissionOverride.mockResolvedValue(false);

    await expect(
      buildService(users).deletePermissionOverride("user-1", "override-1"),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when the override belongs to a different user", async () => {
    // The repository collapses "doesn't exist" and "belongs to someone else" into the same
    // false result (a single ownership-filtered delete) — both must surface as 404 here.
    const users = createUsersRepository();
    users.deletePermissionOverride.mockResolvedValue(false);

    await expect(
      buildService(users).deletePermissionOverride("user-1", "someone-elses-override"),
    ).rejects.toThrow(NotFoundError);
  });

  it("invalidates the cache only when a row was actually deleted", async () => {
    const users = createUsersRepository();
    users.deletePermissionOverride.mockResolvedValue(true);
    const permissions = createPermissions();

    await buildService(users, createSessionRepository(), permissions).deletePermissionOverride(
      "user-1",
      "override-1",
    );

    expect(permissions.invalidateCacheForUser).toHaveBeenCalledWith("user-1");
  });
});

describe("UsersService.lookupUsers", () => {
  it("resolves by ids when ids is present, ignoring q", async () => {
    const users = createUsersRepository();
    const records: UserLookupRecord[] = [{ id: "user-1", name: "Jane Doe", email: "jane@example.com" }];
    users.findManyByIds.mockResolvedValue(records);

    const result = await buildService(users).lookupUsers({ ids: ["user-1"] });

    expect(result).toEqual(records);
    expect(users.findManyByIds).toHaveBeenCalledWith(["user-1"]);
    expect(users.searchByText).not.toHaveBeenCalled();
  });

  it("searches by text when only q is present, capped at the search limit", async () => {
    const users = createUsersRepository();
    const records: UserLookupRecord[] = [{ id: "user-2", name: "Grace Hopper", email: "grace@example.com" }];
    users.searchByText.mockResolvedValue(records);

    const result = await buildService(users).lookupUsers({ q: "grace" });

    expect(result).toEqual(records);
    expect(users.searchByText).toHaveBeenCalledWith("grace", 10);
    expect(users.findManyByIds).not.toHaveBeenCalled();
  });
});

describe("UsersService.logoutAllForUser", () => {
  it("throws NotFoundError for a missing target user", async () => {
    const users = createUsersRepository();
    users.findById.mockResolvedValue(null);

    await expect(buildService(users).logoutAllForUser("ghost")).rejects.toThrow(NotFoundError);
  });

  it("revokes every session for the target user, not the caller", async () => {
    const users = createUsersRepository();
    const sessions = createSessionRepository();

    await buildService(users, sessions).logoutAllForUser("target-user");

    expect(sessions.revokeAllSessions).toHaveBeenCalledWith("target-user");
  });
});
