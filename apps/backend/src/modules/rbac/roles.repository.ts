import { prisma } from "../../prisma/client.js";

export interface RoleRecord {
  id: string;
  name: string;
  isSystem: boolean;
  createdAt: Date;
}

export interface RoleWithPermissions extends RoleRecord {
  permissionKeys: string[];
}

export interface RolesRepository {
  findById(id: string): Promise<RoleRecord | null>;
  findByName(name: string): Promise<RoleRecord | null>;
  findAll(): Promise<RoleWithPermissions[]>;
  findManyByIds(ids: string[]): Promise<RoleRecord[]>;
  create(name: string): Promise<RoleRecord>;
  rename(id: string, name: string): Promise<RoleRecord>;
  delete(id: string): Promise<void>;
  replacePermissions(roleId: string, permissionKeys: string[]): Promise<void>;
}

export class PrismaRolesRepository implements RolesRepository {
  async findById(id: string): Promise<RoleRecord | null> {
    return prisma.role.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<RoleRecord | null> {
    return prisma.role.findUnique({ where: { name } });
  }

  async findAll(): Promise<RoleWithPermissions[]> {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      permissionKeys: role.permissions.map((rolePermission) => rolePermission.permission.key),
    }));
  }

  async findManyByIds(ids: string[]): Promise<RoleRecord[]> {
    return prisma.role.findMany({ where: { id: { in: ids } } });
  }

  async create(name: string): Promise<RoleRecord> {
    return prisma.role.create({ data: { name, isSystem: false } });
  }

  async rename(id: string, name: string): Promise<RoleRecord> {
    return prisma.role.update({ where: { id }, data: { name } });
  }

  async delete(id: string): Promise<void> {
    await prisma.role.delete({ where: { id } });
  }

  async replacePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({
        where: { key: { in: permissionKeys } },
        select: { id: true },
      });

      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
        });
      }
    });
  }
}
