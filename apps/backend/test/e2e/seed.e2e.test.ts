import { PERMISSION_KEYS } from "@task-tracker/shared-types";
import bcrypt from "bcryptjs";
import { redisClient } from "../../src/common/redis/client.js";
import { prisma } from "../../src/prisma/client.js";
import { main as runSeed, USER_ROLE_PERMISSIONS } from "../../src/prisma/seed.js";

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "";

afterAll(async () => {
  await prisma.$disconnect();
  // seedAdminUser touches Redis via permissionsService.addUserToRoleIndex — without this,
  // the connection it opens (or reopens, if auth.e2e.test.ts already disconnected it) is the
  // one open handle left when the whole suite finishes.
  redisClient.disconnect();
});

describe("prisma seed", () => {
  it("provisions the permission catalog and the USER/ADMIN roles on a fresh database", async () => {
    await runSeed();

    const permissions = await prisma.permission.findMany();
    expect(permissions.map((permission) => permission.key).sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );

    const userRole = await prisma.role.findUniqueOrThrow({
      where: { name: "USER" },
      include: { permissions: { include: { permission: true } } },
    });
    expect(userRole.permissions.map((entry) => entry.permission.key).sort()).toEqual(
      [...USER_ROLE_PERMISSIONS].sort(),
    );

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { name: "ADMIN" },
      include: { permissions: { include: { permission: true } } },
    });
    expect(adminRole.permissions.map((entry) => entry.permission.key).sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );

    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: ADMIN_EMAIL },
      include: { roles: { include: { role: true } } },
    });
    expect(adminUser.roles.map((entry) => entry.role.name)).toContain("ADMIN");
    await expect(
      bcrypt.compare(process.env.ADMIN_SEED_PASSWORD ?? "", adminUser.passwordHash),
    ).resolves.toBe(true);
  });

  it("never touches an existing admin account's password hash on re-seed", async () => {
    await runSeed();

    const before = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });

    await runSeed();

    const after = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.id).toBe(before.id);
  });

  it("refuses to seed the admin account without a valid ADMIN_SEED_PASSWORD", async () => {
    await runSeed();
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });

    // Simulate a genuinely fresh environment for just the admin account, since seedAdminUser
    // only ever reads ADMIN_SEED_PASSWORD when no admin row exists yet.
    await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });

    const originalPassword = process.env.ADMIN_SEED_PASSWORD;
    delete process.env.ADMIN_SEED_PASSWORD;

    try {
      await expect(runSeed()).rejects.toThrow(/ADMIN_SEED_PASSWORD/);
      await expect(prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })).resolves.toBeNull();
    } finally {
      process.env.ADMIN_SEED_PASSWORD = originalPassword;
      // Restore the fixture other tests (and other e2e suites) implicitly rely on existing.
      await runSeed();
    }
  });

  it("refuses to seed the admin account without a valid ADMIN_SEED_EMAIL", async () => {
    await runSeed();
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });

    // Same reasoning as the ADMIN_SEED_PASSWORD case above — the email is only ever read
    // when no admin row exists yet, so this simulates a genuinely fresh environment.
    await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });

    const originalEmail = process.env.ADMIN_SEED_EMAIL;
    process.env.ADMIN_SEED_EMAIL = "not-an-email";

    try {
      await expect(runSeed()).rejects.toThrow(/ADMIN_SEED_EMAIL/);
      await expect(prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })).resolves.toBeNull();
    } finally {
      process.env.ADMIN_SEED_EMAIL = originalEmail;
      // Restore the fixture other tests (and other e2e suites) implicitly rely on existing.
      await runSeed();
    }
  });

  it("never re-derives an existing role's permissions, so an admin customization survives re-seeding", async () => {
    await runSeed();

    const userRole = await prisma.role.findUniqueOrThrow({ where: { name: "USER" } });
    const taskCreatePermission = await prisma.permission.findUniqueOrThrow({
      where: { key: "task:create" },
    });

    // Simulate an admin having used the (future) RBAC admin API to revoke a permission
    // from the USER role in production.
    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: { roleId: userRole.id, permissionId: taskCreatePermission.id },
      },
    });

    try {
      await runSeed();

      const permissionsAfterReseed = await prisma.rolePermission.findMany({
        where: { roleId: userRole.id },
      });
      expect(
        permissionsAfterReseed.some((entry) => entry.permissionId === taskCreatePermission.id),
      ).toBe(false);
    } finally {
      // Other e2e suites assume the USER role still has its full default permission set —
      // restore it regardless of whether the assertion above passed.
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: userRole.id, permissionId: taskCreatePermission.id },
        },
        update: {},
        create: { roleId: userRole.id, permissionId: taskCreatePermission.id },
      });
    }
  });
});
