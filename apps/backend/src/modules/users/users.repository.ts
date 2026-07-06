import type { PermissionEffect } from "../../generated/prisma/enums.js";
import { prisma } from "../../prisma/client.js";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithRoles extends UserRecord {
  roles: string[];
}

export interface PermissionOverrideRecord {
  id: string;
  permissionKey: string;
  effect: PermissionEffect;
}

export interface UserWithOverrides extends UserWithRoles {
  overrides: PermissionOverrideRecord[];
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface CreatedUser {
  user: UserRecord;
  roleId: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedUsers {
  users: UserWithRoles[];
  total: number;
}

export interface RoleAssignmentDiff {
  added: string[];
  removed: string[];
}

export interface UserLookupRecord {
  id: string;
  name: string;
  email: string;
}

export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByIdWithRoles(id: string): Promise<UserWithRoles | null>;
  createWithDefaultRole(input: CreateUserInput): Promise<CreatedUser>;
  findManyPaginated(params: PaginationParams): Promise<PaginatedUsers>;
  findByIdWithOverrides(id: string): Promise<UserWithOverrides | null>;
  replaceRoles(userId: string, roleIds: string[]): Promise<RoleAssignmentDiff>;
  upsertPermissionOverride(
    userId: string,
    permissionKey: string,
    effect: PermissionEffect,
  ): Promise<void>;
  deletePermissionOverride(userId: string, permissionOverrideId: string): Promise<boolean>;
  findManyByIds(ids: string[]): Promise<UserLookupRecord[]>;
  searchByText(query: string, limit: number): Promise<UserLookupRecord[]>;
}

export class PrismaUsersRepository implements UsersRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByIdWithRoles(id: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      roles: user.roles.map((userRole) => userRole.role.name),
    };
  }

  async createWithDefaultRole(input: CreateUserInput): Promise<CreatedUser> {
    return prisma.$transaction(async (tx) => {
      const defaultRole = await tx.role.findUniqueOrThrow({ where: { name: "USER" } });

      const user = await tx.user.create({ data: input });

      await tx.userRole.create({
        data: { userId: user.id, roleId: defaultRole.id },
      });

      return { user, roleId: defaultRole.id };
    });
  }

  // No default sort is locked for this endpoint — reusing createdAt DESC since it's the one
  // sort convention established anywhere in the contract, for consistency.
  async findManyPaginated({ page, limit }: PaginationParams): Promise<PaginatedUsers> {
    const [records, total] = await prisma.$transaction([
      prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { roles: { include: { role: true } } },
      }),
      prisma.user.count(),
    ]);

    return {
      users: records.map((user) => ({
        ...user,
        roles: user.roles.map((userRole) => userRole.role.name),
      })),
      total,
    };
  }

  async findByIdWithOverrides(id: string): Promise<UserWithOverrides | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        permissionOverrides: { include: { permission: true } },
      },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      roles: user.roles.map((userRole) => userRole.role.name),
      overrides: user.permissionOverrides.map((override) => ({
        id: override.id,
        permissionKey: override.permission.key,
        effect: override.effect,
      })),
    };
  }

  async replaceRoles(userId: string, roleIds: string[]): Promise<RoleAssignmentDiff> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.userRole.findMany({ where: { userId }, select: { roleId: true } });
      const currentRoleIds = existing.map((userRole) => userRole.roleId);

      const added = roleIds.filter((roleId) => !currentRoleIds.includes(roleId));
      const removed = currentRoleIds.filter((roleId) => !roleIds.includes(roleId));

      if (removed.length > 0) {
        await tx.userRole.deleteMany({ where: { userId, roleId: { in: removed } } });
      }
      if (added.length > 0) {
        await tx.userRole.createMany({ data: added.map((roleId) => ({ userId, roleId })) });
      }

      return { added, removed };
    });
  }

  async upsertPermissionOverride(
    userId: string,
    permissionKey: string,
    effect: PermissionEffect,
  ): Promise<void> {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: permissionKey },
    });

    await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
      create: { userId, permissionId: permission.id, effect },
      update: { effect },
    });
  }

  // A single filtered delete rather than a separate ownership-lookup query: a mismatched
  // userId behaves identically to a nonexistent override (count 0), which is exactly the
  // 404-for-both behavior the caller needs.
  async deletePermissionOverride(userId: string, permissionOverrideId: string): Promise<boolean> {
    const result = await prisma.userPermission.deleteMany({
      where: { id: permissionOverrideId, userId },
    });

    return result.count > 0;
  }

  async findManyByIds(ids: string[]): Promise<UserLookupRecord[]> {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
  }

  async searchByText(query: string, limit: number): Promise<UserLookupRecord[]> {
    return prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: limit,
      orderBy: { name: "asc" },
    });
  }
}
