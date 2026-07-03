import { PERMISSION_KEYS } from "@task-tracker/shared-types";
import { prisma } from "./client.js";

const USER_ROLE_PERMISSIONS = [
  "task:create",
  "task:read:own",
  "task:update:own",
  "task:delete:own",
] as const;

async function seedPermissionCatalog() {
  await Promise.all(
    PERMISSION_KEYS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      }),
    ),
  );
}

async function seedRole(name: string, isSystem: boolean, permissionKeys: readonly string[]) {
  const role = await prisma.role.upsert({
    where: { name },
    update: { isSystem },
    create: { name, isSystem },
  });

  const permissions = await prisma.permission.findMany({
    where: { key: { in: [...permissionKeys] } },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
  });

  return role;
}

async function main() {
  await seedPermissionCatalog();
  await seedRole("USER", true, USER_ROLE_PERMISSIONS);
  await seedRole("ADMIN", true, PERMISSION_KEYS);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
