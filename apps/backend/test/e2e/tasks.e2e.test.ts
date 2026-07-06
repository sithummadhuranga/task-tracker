import request from "supertest";
import { API_PREFIX } from "../../src/common/config/api-version.js";
import { redisClient } from "../../src/common/redis/client.js";
import { prisma } from "../../src/prisma/client.js";
import {
  app,
  createUserWithPermissions,
  createZeroPermissionUser,
  loginAsAdmin,
  USERS_BASE,
  type FixtureUser,
} from "./helpers/rbac-fixtures.js";

const TASKS_BASE = `${API_PREFIX}/tasks`;

// Every registered user is auto-assigned the USER role, which already grants task:create,
// task:read:own, task:update:own and task:delete:own by default — so createZeroPermissionUser
// alone can never produce a caller genuinely lacking one of those. A DENY override is the only
// real pathway the locked contract offers to take a permission away from a role-derived grant.
async function denyPermission(target: FixtureUser, permissionKey: string): Promise<void> {
  const admin = await loginAsAdmin();

  const response = await request(app)
    .post(`${USERS_BASE}/${target.userId}/permissions`)
    .set("Authorization", `Bearer ${admin.accessToken}`)
    .send({ permissionKey, effect: "DENY" });

  if (response.status !== 204) {
    throw new Error(`expected DENY override to succeed, got ${response.status}`);
  }
}

interface TaskBody {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string;
  ownerId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedTasksBody {
  data: TaskBody[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const DUE_DATE = new Date("2026-06-01T00:00:00.000Z").toISOString();

function createTaskPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return { title: "Write the report", dueDate: DUE_DATE, ...overrides };
}

afterAll(async () => {
  await prisma.$disconnect();
  // ping() sits behind the rate limiters' fire-and-forget Lua script load (kicked off when
  // app.js was imported) in the same FIFO command queue, so awaiting it guarantees that load
  // has settled before we disconnect instead of racing it — an in-flight load rejected by
  // disconnect logs after Jest considers the file done and fails the run.
  await redisClient.ping().catch(() => undefined);
  redisClient.disconnect();
});

describe(`POST ${TASKS_BASE}`, () => {
  it("creates a task owned by the caller, defaulting status to TODO", async () => {
    const owner = await createUserWithPermissions(["task:create"], "create-owner");

    const response = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());

    expect(response.status).toBe(201);
    const body = response.body as TaskBody;
    expect(body.ownerId).toBe(owner.userId);
    expect(body.status).toBe("TODO");
    expect(body.version).toBe(1);
  });

  it("forces ownerId to the caller when they lack task:read:any, even if a different ownerId is sent", async () => {
    const owner = await createUserWithPermissions(["task:create"], "create-forced-owner");
    const otherUser = await createZeroPermissionUser("create-forced-target");

    const response = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload({ ownerId: otherUser.userId }));

    expect(response.status).toBe(201);
    const body = response.body as TaskBody;
    expect(body.ownerId).toBe(owner.userId);
  });

  it("honors an explicit ownerId when the caller holds task:read:any", async () => {
    const admin = await createUserWithPermissions(["task:create", "task:read:any"], "create-admin");
    const targetOwner = await createZeroPermissionUser("create-admin-target");

    const response = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send(createTaskPayload({ ownerId: targetOwner.userId }));

    expect(response.status).toBe(201);
    const body = response.body as TaskBody;
    expect(body.ownerId).toBe(targetOwner.userId);
  });

  it("allows a due date in the past", async () => {
    const owner = await createUserWithPermissions(["task:create"], "create-past-due");
    const pastDueDate = new Date("2020-01-01T00:00:00.000Z").toISOString();

    const response = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload({ dueDate: pastDueDate }));

    expect(response.status).toBe(201);
  });

  it("rejects a caller without task:create", async () => {
    const user = await createZeroPermissionUser("create-forbidden");
    await denyPermission(user, "task:create");

    const response = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(createTaskPayload());

    expect(response.status).toBe(403);
  });

  it("rejects a missing title with 400", async () => {
    const owner = await createUserWithPermissions(["task:create"], "create-bad-title");

    const response = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ dueDate: DUE_DATE });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid dueDate with 400", async () => {
    const owner = await createUserWithPermissions(["task:create"], "create-bad-duedate");

    const response = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload({ dueDate: "not-a-date" }));

    expect(response.status).toBe(400);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const response = await request(app).post(TASKS_BASE).send(createTaskPayload());

    expect(response.status).toBe(401);
  });
});

describe(`GET ${TASKS_BASE}/:id`, () => {
  it("returns the task to its owner with only task:read:own", async () => {
    const owner = await createUserWithPermissions(["task:create", "task:read:own"], "get-owner");
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;

    const response = await request(app)
      .get(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect((response.body as TaskBody).id).toBe(taskId);
  });

  it("masks another user's task as 404 for a caller with only task:read:own", async () => {
    const owner = await createUserWithPermissions(["task:create", "task:read:own"], "get-mask-owner");
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;
    const otherUser = await createUserWithPermissions(["task:read:own"], "get-mask-other");

    const response = await request(app)
      .get(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${otherUser.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("returns another user's task to a caller with task:read:any", async () => {
    const owner = await createUserWithPermissions(["task:create", "task:read:own"], "get-any-owner");
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;
    const admin = await createUserWithPermissions(["task:read:any"], "get-any-admin");

    const response = await request(app)
      .get(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    expect((response.body as TaskBody).id).toBe(taskId);
  });

  it("returns 404, identical in shape, for a nonexistent task id", async () => {
    const owner = await createUserWithPermissions(["task:read:own"], "get-nonexistent");

    const response = await request(app)
      .get(`${TASKS_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("rejects a caller with neither task:read:own nor task:read:any", async () => {
    const user = await createZeroPermissionUser("get-forbidden");
    await denyPermission(user, "task:read:own");

    const response = await request(app)
      .get(`${TASKS_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(response.status).toBe(403);
  });
});

describe(`GET ${TASKS_BASE}`, () => {
  it("returns a paginated envelope scoped to the caller's own tasks", async () => {
    const owner = await createUserWithPermissions(["task:create", "task:read:own"], "list-owner");
    await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());

    const response = await request(app)
      .get(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as PaginatedTasksBody;
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data.every((task) => task.ownerId === owner.userId)).toBe(true);
  });

  it("returns totalPages: 1, not 0, for a caller with no tasks", async () => {
    const owner = await createZeroPermissionUser("list-empty");

    const response = await request(app)
      .get(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as PaginatedTasksBody;
    expect(body.meta.total).toBe(0);
    expect(body.meta.totalPages).toBe(1);
  });

  it("forces the ownerId filter to the caller even when a different ownerId is requested", async () => {
    const owner = await createUserWithPermissions(["task:create", "task:read:own"], "list-forced-owner");
    await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const otherUser = await createUserWithPermissions(
      ["task:create", "task:read:own"],
      "list-forced-other",
    );
    await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${otherUser.accessToken}`)
      .send(createTaskPayload());

    const response = await request(app)
      .get(TASKS_BASE)
      .query({ ownerId: otherUser.userId })
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as PaginatedTasksBody;
    expect(body.data.every((task) => task.ownerId === owner.userId)).toBe(true);
  });

  it("honors the ownerId filter for a caller with task:read:any", async () => {
    const targetOwner = await createUserWithPermissions(
      ["task:create", "task:read:own"],
      "list-any-target",
    );
    await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${targetOwner.accessToken}`)
      .send(createTaskPayload());
    const admin = await createUserWithPermissions(["task:read:any"], "list-any-admin");

    const response = await request(app)
      .get(TASKS_BASE)
      .query({ ownerId: targetOwner.userId })
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(200);
    const body = response.body as PaginatedTasksBody;
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((task) => task.ownerId === targetOwner.userId)).toBe(true);
  });

  it("rejects an invalid status filter with 400", async () => {
    const owner = await createUserWithPermissions(["task:read:own"], "list-bad-status");

    const response = await request(app)
      .get(TASKS_BASE)
      .query({ status: "NOT_A_STATUS" })
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(400);
  });

  it("rejects a caller with neither task:read:own nor task:read:any", async () => {
    const user = await createZeroPermissionUser("list-forbidden");
    await denyPermission(user, "task:read:own");

    const response = await request(app).get(TASKS_BASE).set("Authorization", `Bearer ${user.accessToken}`);

    expect(response.status).toBe(403);
  });
});

describe(`PATCH ${TASKS_BASE}/:id`, () => {
  it("updates the caller's own task", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:update:own"],
      "update-owner",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;

    const response = await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "IN_PROGRESS", version: 1 });

    expect(response.status).toBe(200);
    const body = response.body as TaskBody;
    expect(body.status).toBe("IN_PROGRESS");
    expect(body.version).toBe(2);
  });

  it("returns 409 when the presented version is stale", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:update:own"],
      "update-stale-version",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;

    await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "IN_PROGRESS", version: 1 });

    const staleResponse = await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "DONE", version: 1 });

    expect(staleResponse.status).toBe(409);
  });

  it("rejects an update body missing version with 400", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:update:own"],
      "update-missing-version",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;

    const response = await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "IN_PROGRESS" });

    expect(response.status).toBe(400);
  });

  it("masks another user's task as 404 for a caller with only task:update:own", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:update:own"],
      "update-mask-owner",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;
    const otherUser = await createUserWithPermissions(["task:update:own"], "update-mask-other");

    const response = await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${otherUser.accessToken}`)
      .send({ status: "DONE", version: 1 });

    expect(response.status).toBe(404);
  });

  it("ignores an ownerId change from a caller without task:update:any", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:update:own"],
      "update-ignore-owner",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;
    const otherUser = await createZeroPermissionUser("update-ignore-target");

    const response = await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ ownerId: otherUser.userId, version: 1 });

    expect(response.status).toBe(200);
    expect((response.body as TaskBody).ownerId).toBe(owner.userId);
  });

  it("honors an ownerId change from a caller with task:update:any", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:update:own"],
      "update-honor-owner",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;
    const admin = await createUserWithPermissions(["task:update:any"], "update-honor-admin");
    const newOwner = await createZeroPermissionUser("update-honor-target");

    const response = await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ ownerId: newOwner.userId, version: 1 });

    expect(response.status).toBe(200);
    expect((response.body as TaskBody).ownerId).toBe(newOwner.userId);
  });

  it("returns 404 for a nonexistent task id", async () => {
    const owner = await createUserWithPermissions(["task:update:own"], "update-nonexistent");

    const response = await request(app)
      .patch(`${TASKS_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "DONE", version: 1 });

    expect(response.status).toBe(404);
  });

  it("rejects an invalid status value with 400", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:update:own"],
      "update-bad-status",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;

    const response = await request(app)
      .patch(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: "NOT_A_STATUS", version: 1 });

    expect(response.status).toBe(400);
  });

  it("rejects a caller with neither task:update:own nor task:update:any", async () => {
    const user = await createZeroPermissionUser("update-forbidden");
    await denyPermission(user, "task:update:own");

    const response = await request(app)
      .patch(`${TASKS_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ status: "DONE", version: 1 });

    expect(response.status).toBe(403);
  });
});

describe(`DELETE ${TASKS_BASE}/:id`, () => {
  it("deletes the caller's own task", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:read:own", "task:delete:own"],
      "delete-owner",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;

    const response = await request(app)
      .delete(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(response.status).toBe(204);

    const getAfterDelete = await request(app)
      .get(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it("soft-deletes: the row still exists with deletedAt set, and it drops out of the list", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:read:own", "task:delete:own"],
      "delete-soft",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;

    await request(app)
      .delete(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const rawRow = await prisma.task.findUnique({ where: { id: taskId } });
    expect(rawRow).not.toBeNull();
    expect(rawRow?.deletedAt).not.toBeNull();

    const listResponse = await request(app)
      .get(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const listBody = listResponse.body as PaginatedTasksBody;
    expect(listBody.data.some((task) => task.id === taskId)).toBe(false);
  });

  it("masks another user's task as 404 for a caller with only task:delete:own", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:delete:own"],
      "delete-mask-owner",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;
    const otherUser = await createUserWithPermissions(["task:delete:own"], "delete-mask-other");

    const response = await request(app)
      .delete(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${otherUser.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("deletes another user's task for a caller with task:delete:any", async () => {
    const owner = await createUserWithPermissions(
      ["task:create", "task:read:own"],
      "delete-any-owner",
    );
    const created = await request(app)
      .post(TASKS_BASE)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send(createTaskPayload());
    const taskId = (created.body as TaskBody).id;
    const admin = await createUserWithPermissions(["task:delete:any"], "delete-any-admin");

    const response = await request(app)
      .delete(`${TASKS_BASE}/${taskId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`);

    expect(response.status).toBe(204);
  });

  it("returns 404 for a nonexistent task id", async () => {
    const owner = await createUserWithPermissions(["task:delete:own"], "delete-nonexistent");

    const response = await request(app)
      .delete(`${TASKS_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(404);
  });

  it("rejects a caller with neither task:delete:own nor task:delete:any", async () => {
    const user = await createZeroPermissionUser("delete-forbidden");
    await denyPermission(user, "task:delete:own");

    const response = await request(app)
      .delete(`${TASKS_BASE}/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    expect(response.status).toBe(403);
  });
});
