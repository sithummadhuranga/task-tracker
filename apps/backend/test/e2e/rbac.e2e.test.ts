import { PERMISSION_KEYS } from "@task-tracker/shared-types";
import request from "supertest";
import { redisClient } from "../../src/common/redis/client.js";
import { prisma } from "../../src/prisma/client.js";
import {
  app,
  createUserWithPermissions,
  createZeroPermissionUser,
  fetchMe,
  loginAsAdmin,
  PERMISSIONS_BASE,
  ROLES_BASE,
  USERS_BASE,
} from "./helpers/rbac-fixtures.js";

interface RoleResponseBody {
  id: string;
  name: string;
  isSystem: boolean;
  permissionKeys?: string[];
}

afterAll(async () => {
  await prisma.$disconnect();
  redisClient.disconnect();
});

describe(`GET ${PERMISSIONS_BASE}`, () => {
  it("returns the full fixed catalog for a caller with role:manage", async () => {
    const admin = await loginAsAdmin();

    const response = await request(app)
      .get(PERMISSIONS_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as { key: string }[];
    expect(body.map((entry) => entry.key).sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it("rejects a caller with none of the required permissions", async () => {
    const user = await createZeroPermissionUser();

    const response = await request(app)
      .get(PERMISSIONS_BASE)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(response.status).toBe(403);
  });
});

describe(`GET ${ROLES_BASE}`, () => {
  it("returns roles with their permission keys for a caller with role:manage", async () => {
    const admin = await loginAsAdmin();

    const response = await request(app)
      .get(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as RoleResponseBody[];
    const userRole = body.find((role) => role.name === "USER");
    expect(userRole?.permissionKeys).toContain("task:create");
  });

  it("rejects a caller without role:manage", async () => {
    const user = await createZeroPermissionUser();

    const response = await request(app)
      .get(ROLES_BASE)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(response.status).toBe(403);
  });
});

describe(`POST ${ROLES_BASE}`, () => {
  it("creates a non-system role with no permissions initially", async () => {
    const admin = await loginAsAdmin();
    const name = `editor-${Date.now()}`;

    const response = await request(app)
      .post(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name });

    expect(response.status).toBe(201);
    const body = response.body as RoleResponseBody;
    expect(body).toMatchObject({ name, isSystem: false });
  });

  it("rejects a duplicate role name with 409", async () => {
    const admin = await loginAsAdmin();
    const name = `dup-role-${Date.now()}`;

    await request(app)
      .post(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name });

    const response = await request(app)
      .post(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name });

    expect(response.status).toBe(409);
  });
});

describe(`PATCH ${ROLES_BASE}/:id`, () => {
  it("renames a non-system role", async () => {
    const admin = await loginAsAdmin();
    const createResponse = await request(app)
      .post(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: `rename-me-${Date.now()}` });
    const role = createResponse.body as RoleResponseBody;
    const newName = `renamed-${Date.now()}`;

    const response = await request(app)
      .patch(`${ROLES_BASE}/${role.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: newName });

    expect(response.status).toBe(200);
    expect((response.body as RoleResponseBody).name).toBe(newName);
  });

  it("rejects renaming to a different role's existing name with 409", async () => {
    const admin = await loginAsAdmin();
    const takenName = `taken-${Date.now()}`;
    await request(app)
      .post(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: takenName });
    const createResponse = await request(app)
      .post(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: `to-rename-${Date.now()}` });
    const role = createResponse.body as RoleResponseBody;

    const response = await request(app)
      .patch(`${ROLES_BASE}/${role.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: takenName });

    expect(response.status).toBe(409);
  });

  it("returns 404 for a nonexistent role id", async () => {
    const admin = await loginAsAdmin();

    const response = await request(app)
      .patch(`${ROLES_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "does-not-matter" });

    expect(response.status).toBe(404);
  });

  it("rejects renaming a system role with 403", async () => {
    const admin = await loginAsAdmin();
    const userRole = await prisma.role.findUniqueOrThrow({ where: { name: "USER" } });

    const response = await request(app)
      .patch(`${ROLES_BASE}/${userRole.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "hijacked-name" });

    expect(response.status).toBe(403);
  });
});

describe(`DELETE ${ROLES_BASE}/:id`, () => {
  it("deletes a non-system role and immediately revokes its holders' derived permissions", async () => {
    // task:read:any is deliberately not one of the USER role's default grants — every
    // registered user gets that role automatically, so asserting against a default-granted
    // key here wouldn't actually prove this role's deletion (vs. the baseline role) did anything.
    const admin = await loginAsAdmin();
    const holder = await createUserWithPermissions(["task:read:any"], "delete-role-holder");

    const beforeDelete = await fetchMe(holder.accessToken);
    expect(beforeDelete.permissions).toContain("task:read:any");

    const response = await request(app)
      .delete(`${ROLES_BASE}/${holder.roleId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(response.status).toBe(204);

    const afterDelete = await fetchMe(holder.accessToken);
    expect(afterDelete.permissions).not.toContain("task:read:any");
  });

  it("rejects deleting a system role with 403", async () => {
    const admin = await loginAsAdmin();
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });

    const response = await request(app)
      .delete(`${ROLES_BASE}/${adminRole.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(403);
  });
});

describe(`PATCH ${ROLES_BASE}/:id/permissions`, () => {
  it("replaces the role's permission set and the new set is active on the holder's next request", async () => {
    // task:read:any / task:update:any are both outside the USER role's default grants, so
    // their presence/absence here can only be explained by this role's own permission set.
    const admin = await loginAsAdmin();
    const holder = await createUserWithPermissions(["task:read:any"], "replace-perms-holder");

    const beforeReplace = await fetchMe(holder.accessToken);
    expect(beforeReplace.permissions).toContain("task:read:any");
    expect(beforeReplace.permissions).not.toContain("task:update:any");

    const response = await request(app)
      .patch(`${ROLES_BASE}/${holder.roleId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKeys: ["task:update:any"] });
    expect(response.status).toBe(204);

    const afterReplace = await fetchMe(holder.accessToken);
    expect(afterReplace.permissions).not.toContain("task:read:any");
    expect(afterReplace.permissions).toContain("task:update:any");
  });

  it("rejects a caller without role:manage", async () => {
    const holder = await createUserWithPermissions(["task:read:any"], "replace-perms-forbidden");
    const zeroPermissionCaller = await createZeroPermissionUser();

    const response = await request(app)
      .patch(`${ROLES_BASE}/${holder.roleId}/permissions`)
      .set("Authorization", `Bearer ${zeroPermissionCaller.accessToken}`)
      .send({ permissionKeys: ["task:create"] });

    expect(response.status).toBe(403);
  });

  it("rejects an invalid permission key with 400", async () => {
    const admin = await loginAsAdmin();
    const holder = await createUserWithPermissions([], "replace-perms-invalid-key");

    const response = await request(app)
      .patch(`${ROLES_BASE}/${holder.roleId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKeys: ["not:a:real:key"] });

    expect(response.status).toBe(400);
  });

  it("rejects replacing a system role's permissions with 403", async () => {
    const admin = await loginAsAdmin();
    const userRole = await prisma.role.findUniqueOrThrow({ where: { name: "USER" } });

    const response = await request(app)
      .patch(`${ROLES_BASE}/${userRole.id}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKeys: ["task:create"] });

    expect(response.status).toBe(403);
  });
});

describe(`POST ${USERS_BASE}/:id/roles`, () => {
  it("fully replaces the user's role assignments, taking effect on their next request", async () => {
    const admin = await loginAsAdmin();
    const target = await createZeroPermissionUser("assign-target");
    const role = await request(app)
      .post(ROLES_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: `assignable-${Date.now()}` });
    const roleBody = role.body as RoleResponseBody;
    await request(app)
      .patch(`${ROLES_BASE}/${roleBody.id}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKeys: ["task:read:any"] });

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/roles`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ roleIds: [roleBody.id] });
    expect(response.status).toBe(204);

    const me = await fetchMe(target.accessToken);
    expect(me.permissions).toContain("task:read:any");
  });

  it("rejects a caller without role:manage", async () => {
    const zeroPermissionCaller = await createZeroPermissionUser();
    const target = await createZeroPermissionUser("assign-forbidden-target");

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/roles`)
      .set("Authorization", `Bearer ${zeroPermissionCaller.accessToken}`)
      .send({ roleIds: [] });

    expect(response.status).toBe(403);
  });

  it("returns 404 for a nonexistent roleId in the array", async () => {
    const admin = await loginAsAdmin();
    const target = await createZeroPermissionUser("assign-missing-role");

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/roles`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ roleIds: ["00000000-0000-0000-0000-000000000000"] });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent user id", async () => {
    const admin = await loginAsAdmin();

    const response = await request(app)
      .post(`${USERS_BASE}/00000000-0000-0000-0000-000000000000/roles`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ roleIds: [] });

    expect(response.status).toBe(404);
  });
});
