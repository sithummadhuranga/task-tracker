import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { PERMISSION_KEYS, registerSchema } from "@task-tracker/shared-types";
import { BCRYPT_COST } from "../common/security/password.js";
import { permissionsService } from "../modules/rbac/permissions.service.js";
import { prisma } from "./client.js";

export const USER_ROLE_PERMISSIONS = [
  "task:create",
  "task:read:own",
  "task:update:own",
  "task:delete:own",
] as const;

const ADMIN_NAME = "Admin";

async function seedPermissionCatalog() {
  // update: {} — this only ever creates a missing row, never rewrites an existing one, and
  // a key removed from the code catalog is simply left alone rather than deleted, since
  // deleting it would cascade into any RolePermission/UserPermission row still referencing it.
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

async function seedRole(
  name: string,
  isSystem: boolean,
  permissionKeys: readonly string[],
): Promise<string> {
  // Deliberately create-only, past this point. Re-deriving RolePermission from the code
  // catalog on every run (the previous behavior) meant a deploy would silently overwrite
  // whatever an admin had customized for this role via the RBAC admin API — this must never
  // touch a role that already exists.
  const existing = await prisma.role.findUnique({ where: { name } });

  if (existing) {
    return existing.id;
  }

  const role = await prisma.role.create({ data: { name, isSystem } });
  const permissions = await prisma.permission.findMany({
    where: { key: { in: [...permissionKeys] } },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
  });

  return role.id;
}

async function seedAdminUser(adminRoleId: string): Promise<void> {
  // No hardcoded identity for this account, email included — every environment (local, CI,
  // staging, production) supplies its own via ADMIN_SEED_EMAIL, so the codebase never
  // encodes who the admin actually is.
  const emailCheck = registerSchema.shape.email.safeParse(process.env.ADMIN_SEED_EMAIL);

  if (!emailCheck.success) {
    throw new Error(
      "ADMIN_SEED_EMAIL is required to seed the initial admin account and must be a valid email address.",
    );
  }

  const adminEmail = emailCheck.data;

  // Create-only, same reasoning as seedRole — an existing admin account's password is never
  // touched by a re-seed, so rotating it later (once there's a real flow for that) can't be
  // silently undone by the next deploy.
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existing) {
    return;
  }

  const passwordCheck = registerSchema.shape.password.safeParse(process.env.ADMIN_SEED_PASSWORD);

  if (!passwordCheck.success) {
    throw new Error(
      "ADMIN_SEED_PASSWORD is required to seed the initial admin account and must satisfy the " +
        "same password policy as regular users (min 8 characters, at least one digit).",
    );
  }

  const passwordHash = await bcrypt.hash(passwordCheck.data, BCRYPT_COST);
  const user = await prisma.user.create({
    data: { email: adminEmail, name: ADMIN_NAME, passwordHash },
  });

  await prisma.userRole.create({ data: { userId: user.id, roleId: adminRoleId } });
  await permissionsService.addUserToRoleIndex(user.id, adminRoleId);
}

export async function main() {
  await seedPermissionCatalog();
  await seedRole("USER", true, USER_ROLE_PERMISSIONS);
  const adminRoleId = await seedRole("ADMIN", true, PERMISSION_KEYS);
  await seedAdminUser(adminRoleId);
}

// Only run when executed directly (`tsx src/prisma/seed.ts` / `prisma db seed`) — importing
// this module for tests must not trigger a live seed run as a side effect.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
      process.exit(process.exitCode ?? 0);
    });
}
