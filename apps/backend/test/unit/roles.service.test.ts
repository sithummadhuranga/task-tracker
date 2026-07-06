import { jest } from "@jest/globals";
import { ConflictError, ForbiddenError, NotFoundError } from "../../src/common/errors/index.js";
import type {
  RoleAssignableUsersRepository,
  RoleIndexUpdater,
} from "../../src/modules/rbac/roles.service.js";
import { RolesService } from "../../src/modules/rbac/roles.service.js";
import type {
  RoleRecord,
  RolesRepository,
  RoleWithPermissions,
} from "../../src/modules/rbac/roles.repository.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function buildRole(overrides: Partial<RoleRecord> = {}): RoleRecord {
  return {
    id: "role-1",
    name: "EDITOR",
    isSystem: false,
    createdAt: NOW,
    ...overrides,
  };
}

interface RolesRepositoryMocks {
  repository: RolesRepository;
  findById: jest.Mock<RolesRepository["findById"]>;
  findByName: jest.Mock<RolesRepository["findByName"]>;
  findAll: jest.Mock<RolesRepository["findAll"]>;
  findManyByIds: jest.Mock<RolesRepository["findManyByIds"]>;
  create: jest.Mock<RolesRepository["create"]>;
  rename: jest.Mock<RolesRepository["rename"]>;
  deleteRole: jest.Mock<RolesRepository["delete"]>;
  replacePermissions: jest.Mock<RolesRepository["replacePermissions"]>;
}

function createRolesRepository(): RolesRepositoryMocks {
  const findById = jest.fn<RolesRepository["findById"]>(() => Promise.resolve(buildRole()));
  const findByName = jest.fn<RolesRepository["findByName"]>(() => Promise.resolve(null));
  const findAll = jest.fn<RolesRepository["findAll"]>(() => Promise.resolve([]));
  const findManyByIds = jest.fn<RolesRepository["findManyByIds"]>((ids) =>
    Promise.resolve(ids.map((id) => buildRole({ id }))),
  );
  const create = jest.fn<RolesRepository["create"]>((name) => Promise.resolve(buildRole({ name })));
  const rename = jest.fn<RolesRepository["rename"]>((id, name) =>
    Promise.resolve(buildRole({ id, name })),
  );
  const deleteRole = jest.fn<RolesRepository["delete"]>(() => Promise.resolve());
  const replacePermissions = jest.fn<RolesRepository["replacePermissions"]>(() =>
    Promise.resolve(),
  );

  return {
    repository: {
      findById,
      findByName,
      findAll,
      findManyByIds,
      create,
      rename,
      delete: deleteRole,
      replacePermissions,
    },
    findById,
    findByName,
    findAll,
    findManyByIds,
    create,
    rename,
    deleteRole,
    replacePermissions,
  };
}

interface UsersRepositoryMocks {
  repository: RoleAssignableUsersRepository;
  findById: jest.Mock<RoleAssignableUsersRepository["findById"]>;
  replaceRoles: jest.Mock<RoleAssignableUsersRepository["replaceRoles"]>;
}

function createUsersRepository(): UsersRepositoryMocks {
  const findById = jest.fn<RoleAssignableUsersRepository["findById"]>(() =>
    Promise.resolve({
      id: "user-1",
      email: "jane@example.com",
      passwordHash: "",
      name: "Jane",
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
  const replaceRoles = jest.fn<RoleAssignableUsersRepository["replaceRoles"]>(() =>
    Promise.resolve({ added: [], removed: [] }),
  );

  return { repository: { findById, replaceRoles }, findById, replaceRoles };
}

interface PermissionsMocks {
  permissions: RoleIndexUpdater;
  invalidateCacheForUser: jest.Mock<RoleIndexUpdater["invalidateCacheForUser"]>;
  invalidateCacheForRole: jest.Mock<RoleIndexUpdater["invalidateCacheForRole"]>;
  addUserToRoleIndex: jest.Mock<RoleIndexUpdater["addUserToRoleIndex"]>;
  removeUserFromRoleIndex: jest.Mock<RoleIndexUpdater["removeUserFromRoleIndex"]>;
  deleteRoleIndex: jest.Mock<RoleIndexUpdater["deleteRoleIndex"]>;
}

function createPermissions(): PermissionsMocks {
  const invalidateCacheForUser = jest.fn<RoleIndexUpdater["invalidateCacheForUser"]>(() =>
    Promise.resolve(),
  );
  const invalidateCacheForRole = jest.fn<RoleIndexUpdater["invalidateCacheForRole"]>(() =>
    Promise.resolve(),
  );
  const addUserToRoleIndex = jest.fn<RoleIndexUpdater["addUserToRoleIndex"]>(() =>
    Promise.resolve(),
  );
  const removeUserFromRoleIndex = jest.fn<RoleIndexUpdater["removeUserFromRoleIndex"]>(() =>
    Promise.resolve(),
  );
  const deleteRoleIndex = jest.fn<RoleIndexUpdater["deleteRoleIndex"]>(() => Promise.resolve());

  return {
    permissions: {
      invalidateCacheForUser,
      invalidateCacheForRole,
      addUserToRoleIndex,
      removeUserFromRoleIndex,
      deleteRoleIndex,
    },
    invalidateCacheForUser,
    invalidateCacheForRole,
    addUserToRoleIndex,
    removeUserFromRoleIndex,
    deleteRoleIndex,
  };
}

function buildService(
  roles: RolesRepositoryMocks = createRolesRepository(),
  users: UsersRepositoryMocks = createUsersRepository(),
  permissions: PermissionsMocks = createPermissions(),
): RolesService {
  return new RolesService(roles.repository, users.repository, permissions.permissions);
}

describe("RolesService.listRoles", () => {
  it("returns all roles with their permission keys", async () => {
    const roleWithPermissions: RoleWithPermissions = {
      ...buildRole(),
      permissionKeys: ["task:create"],
    };
    const roles = createRolesRepository();
    roles.findAll.mockResolvedValue([roleWithPermissions]);

    const result = await buildService(roles).listRoles();

    expect(result).toEqual([roleWithPermissions]);
  });
});

describe("RolesService.createRole", () => {
  it("throws ConflictError when a role with the same name already exists", async () => {
    const roles = createRolesRepository();
    roles.findByName.mockResolvedValue(buildRole());

    await expect(buildService(roles).createRole("EDITOR")).rejects.toThrow(ConflictError);
  });

  it("creates a role with isSystem false", async () => {
    const roles = createRolesRepository();

    const result = await buildService(roles).createRole("EDITOR");

    expect(result.isSystem).toBe(false);
    expect(roles.create).toHaveBeenCalledWith("EDITOR");
  });
});

describe("RolesService.renameRole", () => {
  it("returns the role unchanged when name is undefined (empty-body no-op)", async () => {
    const roles = createRolesRepository();

    const result = await buildService(roles).renameRole("role-1", undefined);

    expect(result).toEqual(buildRole());
    expect(roles.rename).not.toHaveBeenCalled();
    expect(roles.findByName).not.toHaveBeenCalled();
  });

  it("returns the role unchanged when renaming to its own current name", async () => {
    const roles = createRolesRepository();

    const result = await buildService(roles).renameRole("role-1", "EDITOR");

    expect(result).toEqual(buildRole());
    expect(roles.rename).not.toHaveBeenCalled();
  });

  it("throws ConflictError when renaming to a different role's existing name", async () => {
    const roles = createRolesRepository();
    roles.findByName.mockResolvedValue(buildRole({ id: "role-2", name: "OTHER" }));

    await expect(buildService(roles).renameRole("role-1", "OTHER")).rejects.toThrow(
      ConflictError,
    );
  });

  it("throws ForbiddenError when renaming a system role to a genuinely new name", async () => {
    const roles = createRolesRepository();
    roles.findById.mockResolvedValue(buildRole({ isSystem: true }));

    await expect(buildService(roles).renameRole("role-1", "NEW_NAME")).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("throws NotFoundError for a nonexistent role", async () => {
    const roles = createRolesRepository();
    roles.findById.mockResolvedValue(null);

    await expect(buildService(roles).renameRole("ghost", "NEW_NAME")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("renames successfully when the new name is free", async () => {
    const roles = createRolesRepository();

    await buildService(roles).renameRole("role-1", "NEW_NAME");

    expect(roles.rename).toHaveBeenCalledWith("role-1", "NEW_NAME");
  });
});

describe("RolesService.deleteRole", () => {
  it("throws ForbiddenError when the role is a system role", async () => {
    const roles = createRolesRepository();
    roles.findById.mockResolvedValue(buildRole({ isSystem: true }));

    await expect(buildService(roles).deleteRole("role-1")).rejects.toThrow(ForbiddenError);
    expect(roles.deleteRole).not.toHaveBeenCalled();
  });

  it("throws NotFoundError for a nonexistent role", async () => {
    const roles = createRolesRepository();
    roles.findById.mockResolvedValue(null);

    await expect(buildService(roles).deleteRole("ghost")).rejects.toThrow(NotFoundError);
  });

  it("invalidates the role's cache before deleting the role's reverse-index key", async () => {
    const callOrder: string[] = [];
    const permissions = createPermissions();
    permissions.invalidateCacheForRole.mockImplementation(() => {
      callOrder.push("invalidateCacheForRole");
      return Promise.resolve();
    });
    permissions.deleteRoleIndex.mockImplementation(() => {
      callOrder.push("deleteRoleIndex");
      return Promise.resolve();
    });
    const roles = createRolesRepository();

    await buildService(roles, createUsersRepository(), permissions).deleteRole("role-1");

    expect(callOrder).toEqual(["invalidateCacheForRole", "deleteRoleIndex"]);
    expect(permissions.invalidateCacheForRole).toHaveBeenCalledWith("role-1");
    expect(permissions.deleteRoleIndex).toHaveBeenCalledWith("role-1");
    expect(roles.deleteRole).toHaveBeenCalledWith("role-1");
  });
});

describe("RolesService.replaceRolePermissions", () => {
  it("throws NotFoundError for a nonexistent role", async () => {
    const roles = createRolesRepository();
    roles.findById.mockResolvedValue(null);

    await expect(
      buildService(roles).replaceRolePermissions("ghost", ["task:create"]),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError for a system role", async () => {
    const roles = createRolesRepository();
    roles.findById.mockResolvedValue(buildRole({ isSystem: true }));

    await expect(
      buildService(roles).replaceRolePermissions("role-1", ["task:create"]),
    ).rejects.toThrow(ForbiddenError);
  });

  it("dedupes duplicate permission keys before persisting", async () => {
    const roles = createRolesRepository();

    await buildService(roles).replaceRolePermissions("role-1", [
      "task:create",
      "task:create",
      "task:read:own",
    ]);

    expect(roles.replacePermissions).toHaveBeenCalledWith("role-1", [
      "task:create",
      "task:read:own",
    ]);
  });

  it("invalidates the role's cache exactly once after replacing", async () => {
    const roles = createRolesRepository();
    const permissions = createPermissions();

    await buildService(roles, createUsersRepository(), permissions).replaceRolePermissions(
      "role-1",
      ["task:create"],
    );

    expect(permissions.invalidateCacheForRole).toHaveBeenCalledTimes(1);
    expect(permissions.invalidateCacheForRole).toHaveBeenCalledWith("role-1");
  });
});

describe("RolesService.assignUserRoles", () => {
  it("throws NotFoundError for a nonexistent user", async () => {
    const users = createUsersRepository();
    users.findById.mockResolvedValue(null);

    await expect(
      buildService(createRolesRepository(), users).assignUserRoles("ghost", ["role-1"]),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when any submitted roleId doesn't exist", async () => {
    const roles = createRolesRepository();
    roles.findManyByIds.mockResolvedValue([buildRole({ id: "role-1" })]);

    await expect(
      buildService(roles).assignUserRoles("user-1", ["role-1", "role-2"]),
    ).rejects.toThrow(NotFoundError);
  });

  it("dedupes duplicate roleIds before diffing/persisting", async () => {
    const roles = createRolesRepository();
    const users = createUsersRepository();

    await buildService(roles, users).assignUserRoles("user-1", ["role-1", "role-1"]);

    expect(roles.findManyByIds).toHaveBeenCalledWith(["role-1"]);
    expect(users.replaceRoles).toHaveBeenCalledWith("user-1", ["role-1"]);
  });

  it("updates the role index for every added and removed role", async () => {
    const roles = createRolesRepository();
    const users = createUsersRepository();
    users.replaceRoles.mockResolvedValue({ added: ["role-2"], removed: ["role-1"] });
    const permissions = createPermissions();

    await buildService(roles, users, permissions).assignUserRoles("user-1", ["role-2"]);

    expect(permissions.removeUserFromRoleIndex).toHaveBeenCalledWith("user-1", "role-1");
    expect(permissions.addUserToRoleIndex).toHaveBeenCalledWith("user-1", "role-2");
  });

  it("invalidates the user's cache exactly once even when the diff is empty (identical-set replacement)", async () => {
    const roles = createRolesRepository();
    const users = createUsersRepository();
    users.replaceRoles.mockResolvedValue({ added: [], removed: [] });
    const permissions = createPermissions();

    await buildService(roles, users, permissions).assignUserRoles("user-1", ["role-1"]);

    expect(permissions.invalidateCacheForUser).toHaveBeenCalledTimes(1);
    expect(permissions.addUserToRoleIndex).not.toHaveBeenCalled();
    expect(permissions.removeUserFromRoleIndex).not.toHaveBeenCalled();
  });

  it("handles replacing with an empty roleIds array (removes all roles)", async () => {
    const roles = createRolesRepository();
    roles.findManyByIds.mockResolvedValue([]);
    const users = createUsersRepository();
    users.replaceRoles.mockResolvedValue({ added: [], removed: ["role-1"] });
    const permissions = createPermissions();

    await buildService(roles, users, permissions).assignUserRoles("user-1", []);

    expect(users.replaceRoles).toHaveBeenCalledWith("user-1", []);
    expect(permissions.removeUserFromRoleIndex).toHaveBeenCalledWith("user-1", "role-1");
    expect(permissions.invalidateCacheForUser).toHaveBeenCalledTimes(1);
  });
});
