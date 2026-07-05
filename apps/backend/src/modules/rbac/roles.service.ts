import type { PermissionKey } from "@task-tracker/shared-types";
import { ConflictError, ForbiddenError, NotFoundError } from "../../common/errors/index.js";
import { PrismaUsersRepository, type UsersRepository } from "../users/users.repository.js";
import { permissionsService, type PermissionsService } from "./permissions.service.js";
import {
  PrismaRolesRepository,
  type RoleRecord,
  type RolesRepository,
  type RoleWithPermissions,
} from "./roles.repository.js";

export type RoleIndexUpdater = Pick<
  PermissionsService,
  | "invalidateCacheForUser"
  | "invalidateCacheForRole"
  | "addUserToRoleIndex"
  | "removeUserFromRoleIndex"
  | "deleteRoleIndex"
>;

export type RoleAssignableUsersRepository = Pick<UsersRepository, "findById" | "replaceRoles">;

export class RolesService {
  constructor(
    private readonly repository: RolesRepository = new PrismaRolesRepository(),
    private readonly usersRepository: RoleAssignableUsersRepository = new PrismaUsersRepository(),
    private readonly permissions: RoleIndexUpdater = permissionsService,
  ) {}

  async listRoles(): Promise<RoleWithPermissions[]> {
    return this.repository.findAll();
  }

  async createRole(name: string): Promise<RoleRecord> {
    const existing = await this.repository.findByName(name);

    if (existing) {
      throw new ConflictError("a role with this name already exists");
    }

    return this.repository.create(name);
  }

  // An empty body (name undefined) or a no-op rename (identical name) is treated as a success,
  // not an error — the contract doesn't require at least one field to actually change.
  async renameRole(id: string, name: string | undefined): Promise<RoleRecord> {
    const role = await this.requireRole(id);

    if (name === undefined || name === role.name) {
      return role;
    }

    if (role.isSystem) {
      throw new ForbiddenError("system roles cannot be renamed");
    }

    const collision = await this.repository.findByName(name);

    if (collision) {
      throw new ConflictError("a role with this name already exists");
    }

    return this.repository.rename(id, name);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.requireRole(id);

    if (role.isSystem) {
      throw new ForbiddenError("system roles cannot be deleted");
    }

    // Invalidate before dropping the index — once deleteRoleIndex runs, there's no longer any
    // record of who held this role to invalidate for.
    await this.permissions.invalidateCacheForRole(id);
    await this.repository.delete(id);
    await this.permissions.deleteRoleIndex(id);
  }

  async replaceRolePermissions(id: string, permissionKeys: PermissionKey[]): Promise<void> {
    const role = await this.requireRole(id);

    if (role.isSystem) {
      throw new ForbiddenError("system roles cannot have their permissions replaced");
    }

    const uniqueKeys = [...new Set(permissionKeys)];
    await this.repository.replacePermissions(id, uniqueKeys);
    await this.permissions.invalidateCacheForRole(id);
  }

  async assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError("user not found");
    }

    const uniqueRoleIds = [...new Set(roleIds)];
    const roles = await this.repository.findManyByIds(uniqueRoleIds);

    if (roles.length !== uniqueRoleIds.length) {
      throw new NotFoundError("one or more roles not found");
    }

    const { added, removed } = await this.usersRepository.replaceRoles(userId, uniqueRoleIds);

    await Promise.all([
      ...removed.map((roleId) => this.permissions.removeUserFromRoleIndex(userId, roleId)),
      ...added.map((roleId) => this.permissions.addUserToRoleIndex(userId, roleId)),
    ]);

    // Unconditional, even when added/removed are both empty (identical-set replacement) — the
    // contract says invalidate immediately after, and treating "nothing changed" as a special
    // case to skip is more complexity than it's worth.
    await this.permissions.invalidateCacheForUser(userId);
  }

  private async requireRole(id: string): Promise<RoleRecord> {
    const role = await this.repository.findById(id);

    if (!role) {
      throw new NotFoundError("role not found");
    }

    return role;
  }
}

export const rolesService = new RolesService();
