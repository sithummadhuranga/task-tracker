import type { PermissionEffect } from "../../generated/prisma/enums.js";
import { prisma } from "../../prisma/client.js";

export interface PermissionOverride {
  key: string;
  effect: PermissionEffect;
}

export interface PermissionSources {
  roleKeys: string[];
  overrides: PermissionOverride[];
}

export interface PermissionCatalogEntry {
  id: string;
  key: string;
}

export interface PermissionsRepository {
  getPermissionSources(userId: string): Promise<PermissionSources>;
  listCatalog(): Promise<PermissionCatalogEntry[]>;
}

export class PrismaPermissionsRepository implements PermissionsRepository {
  async getPermissionSources(userId: string): Promise<PermissionSources> {
    const [roleAssignments, overrides] = await Promise.all([
      prisma.userRole.findMany({
        where: { userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      }),
      prisma.userPermission.findMany({
        where: { userId },
        include: { permission: true },
      }),
    ]);

    const roleKeys = roleAssignments.flatMap((userRole) =>
      userRole.role.permissions.map((rolePermission) => rolePermission.permission.key),
    );

    return {
      roleKeys,
      overrides: overrides.map((override) => ({
        key: override.permission.key,
        effect: override.effect,
      })),
    };
  }

  async listCatalog(): Promise<PermissionCatalogEntry[]> {
    return prisma.permission.findMany({ select: { id: true, key: true } });
  }
}
