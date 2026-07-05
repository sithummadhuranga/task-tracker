import request from "supertest";
import { redisClient } from "../../src/common/redis/client.js";
import { prisma } from "../../src/prisma/client.js";
import {
  app,
  AUTH_BASE,
  createUserWithPermissions,
  createZeroPermissionUser,
  fetchMe,
  loginAsAdmin,
  registerAndLoginWithSession,
  USERS_BASE,
} from "./helpers/rbac-fixtures.js";

interface UserDetailBody {
  user: { id: string; email: string; name: string };
  roles: string[];
  overrides: { id: string; permissionKey: string; effect: "GRANT" | "DENY" }[];
}

interface PaginatedUsersBody {
  data: { id: string }[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

afterAll(async () => {
  await prisma.$disconnect();
  redisClient.disconnect();
});

describe(`GET ${USERS_BASE}`, () => {
  it("returns a paginated envelope for a caller with user:manage", async () => {
    const admin = await loginAsAdmin();

    const response = await request(app)
      .get(USERS_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as PaginatedUsersBody;
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.totalPages).toBe(Math.ceil(body.meta.total / body.meta.limit));
  });

  it("rejects a caller without user:manage", async () => {
    const user = await createZeroPermissionUser();

    const response = await request(app)
      .get(USERS_BASE)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(response.status).toBe(403);
  });
});

describe(`GET ${USERS_BASE}/:id`, () => {
  it("returns roles and overrides for a caller with user:manage", async () => {
    const admin = await loginAsAdmin();
    const target = await createUserWithPermissions(["task:create"], "detail-target");

    const response = await request(app)
      .get(`${USERS_BASE}/${target.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as UserDetailBody;
    expect(body.user.id).toBe(target.userId);
  });

  it("rejects a caller without user:manage", async () => {
    const user = await createZeroPermissionUser();

    const response = await request(app)
      .get(`${USERS_BASE}/${user.userId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 for a nonexistent user id", async () => {
    const admin = await loginAsAdmin();

    const response = await request(app)
      .get(`${USERS_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe(`POST ${USERS_BASE}/:id/permissions`, () => {
  it("GRANT adds a permission the user doesn't otherwise hold", async () => {
    // task:read:any is outside the USER role's default grants every registered user already
    // has, so its appearance here can only be explained by this GRANT actually working.
    const admin = await loginAsAdmin();
    const target = await createZeroPermissionUser("grant-target");
    const before = await fetchMe(target.accessToken);
    expect(before.permissions).not.toContain("task:read:any");

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKey: "task:read:any", effect: "GRANT" });
    expect(response.status).toBe(204);

    const me = await fetchMe(target.accessToken);
    expect(me.permissions).toContain("task:read:any");
  });

  it("DENY removes a permission the user holds via a role (deny-wins end-to-end)", async () => {
    const admin = await loginAsAdmin();
    const target = await createUserWithPermissions(["task:create"], "deny-target");

    const before = await fetchMe(target.accessToken);
    expect(before.permissions).toContain("task:create");

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKey: "task:create", effect: "DENY" });
    expect(response.status).toBe(204);

    const after = await fetchMe(target.accessToken);
    expect(after.permissions).not.toContain("task:create");
  });

  it("rejects a caller without permission:assign", async () => {
    const zeroPermissionCaller = await createZeroPermissionUser();
    const target = await createZeroPermissionUser("override-forbidden-target");

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/permissions`)
      .set("Authorization", `Bearer ${zeroPermissionCaller.accessToken}`)
      .send({ permissionKey: "task:create", effect: "GRANT" });

    expect(response.status).toBe(403);
  });
});

describe(`DELETE ${USERS_BASE}/:id/permissions/:permissionId`, () => {
  it("removing a GRANT override drops the permission if not role-derived", async () => {
    const admin = await loginAsAdmin();
    const target = await createZeroPermissionUser("remove-grant-target");
    await request(app)
      .post(`${USERS_BASE}/${target.userId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKey: "task:read:any", effect: "GRANT" });
    const detail = await request(app)
      .get(`${USERS_BASE}/${target.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    const override = (detail.body as UserDetailBody).overrides.find(
      (entry) => entry.permissionKey === "task:read:any",
    );
    if (!override) {
      throw new Error("expected the GRANT override to exist");
    }

    const response = await request(app)
      .delete(`${USERS_BASE}/${target.userId}/permissions/${override.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(response.status).toBe(204);

    const me = await fetchMe(target.accessToken);
    expect(me.permissions).not.toContain("task:read:any");
  });

  it("removing a DENY override restores the role-derived permission", async () => {
    // task:create is deliberately used here (unlike the GRANT test above) — the point of this
    // test is specifically that it's role-derived, so removing the DENY should bring it back.
    const admin = await loginAsAdmin();
    const target = await createZeroPermissionUser("remove-deny-target");
    await request(app)
      .post(`${USERS_BASE}/${target.userId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKey: "task:create", effect: "DENY" });
    const denied = await fetchMe(target.accessToken);
    expect(denied.permissions).not.toContain("task:create");

    const detail = await request(app)
      .get(`${USERS_BASE}/${target.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    const override = (detail.body as UserDetailBody).overrides.find(
      (entry) => entry.permissionKey === "task:create",
    );
    if (!override) {
      throw new Error("expected the DENY override to exist");
    }

    const response = await request(app)
      .delete(`${USERS_BASE}/${target.userId}/permissions/${override.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(response.status).toBe(204);

    const restored = await fetchMe(target.accessToken);
    expect(restored.permissions).toContain("task:create");
  });

  it("rejects a caller without permission:assign", async () => {
    const zeroPermissionCaller = await createZeroPermissionUser();

    const response = await request(app)
      .delete(`${USERS_BASE}/${zeroPermissionCaller.userId}/permissions/nonexistent`)
      .set("Authorization", `Bearer ${zeroPermissionCaller.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 when the override belongs to a different user", async () => {
    const admin = await loginAsAdmin();
    const owner = await createZeroPermissionUser("override-owner");
    await request(app)
      .post(`${USERS_BASE}/${owner.userId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKey: "task:create", effect: "GRANT" });
    const detail = await request(app)
      .get(`${USERS_BASE}/${owner.userId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    const override = (detail.body as UserDetailBody).overrides.find(
      (entry) => entry.permissionKey === "task:create",
    );
    if (!override) {
      throw new Error("expected the GRANT override to exist");
    }
    const otherUser = await createZeroPermissionUser("override-other-user");

    const response = await request(app)
      .delete(`${USERS_BASE}/${otherUser.userId}/permissions/${override.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe(`POST ${USERS_BASE}/:id/logout-all`, () => {
  it("revokes the target user's existing session", async () => {
    const admin = await loginAsAdmin();
    const target = await registerAndLoginWithSession("logout-all-target");

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/logout-all`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(response.status).toBe(204);

    const refreshAfter = await request(app)
      .post(`${AUTH_BASE}/refresh`)
      .set("Cookie", target.refreshCookie);
    expect(refreshAfter.status).toBe(401);
  });

  it("rejects a caller without user:manage", async () => {
    const zeroPermissionCaller = await createZeroPermissionUser();
    const target = await createZeroPermissionUser("logout-all-forbidden-target");

    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/logout-all`)
      .set("Authorization", `Bearer ${zeroPermissionCaller.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 for a nonexistent target user id", async () => {
    const admin = await loginAsAdmin();

    const response = await request(app)
      .post(`${USERS_BASE}/00000000-0000-0000-0000-000000000000/logout-all`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(404);
  });
});
