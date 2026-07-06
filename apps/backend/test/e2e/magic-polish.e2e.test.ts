import { jest } from "@jest/globals";
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

const MAGIC_POLISH_URL = `${API_PREFIX}/tasks/magic-polish`;

function mockGeminiResponse(body: { title: string; description: string }): void {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }),
      { status: 200 },
    ),
  );
}

// The default USER role already grants task:create and task:update:own (see the identical note
// in tasks.e2e.test.ts) — a caller genuinely lacking every key this route accepts only exists
// after DENY-overriding all three, same as any other task-write permission boundary test here.
async function denyAllTaskWritePermissions(target: FixtureUser): Promise<void> {
  const admin = await loginAsAdmin();
  for (const permissionKey of ["task:create", "task:update:own", "task:update:any"]) {
    const response = await request(app)
      .post(`${USERS_BASE}/${target.userId}/permissions`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ permissionKey, effect: "DENY" });
    if (response.status !== 204) {
      throw new Error(`expected DENY override for ${permissionKey} to succeed, got ${response.status}`);
    }
  }
}

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redisClient.ping().catch(() => undefined);
  redisClient.disconnect();
});

describe(`POST ${MAGIC_POLISH_URL}`, () => {
  it("returns the polished title/description for a caller who can create tasks", async () => {
    const caller = await createUserWithPermissions(["task:create"], "magic-polish-create");
    mockGeminiResponse({ title: "Write the quarterly report", description: "- Draft\n- Review\n- Submit" });

    const response = await request(app)
      .post(MAGIC_POLISH_URL)
      .set("Authorization", `Bearer ${caller.accessToken}`)
      .send({ title: "write report", description: "draft it, review it, submit it" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      title: "Write the quarterly report",
      description: "- Draft\n- Review\n- Submit",
    });
  });

  it("also allows a caller who only has task:update:own (not task:create)", async () => {
    const caller = await createUserWithPermissions(["task:update:own"], "magic-polish-update-own");
    mockGeminiResponse({ title: "Polished title", description: "Polished description" });

    const response = await request(app)
      .post(MAGIC_POLISH_URL)
      .set("Authorization", `Bearer ${caller.accessToken}`)
      .send({ title: "rough title" });

    expect(response.status).toBe(200);
  });

  it("rejects a caller with none of the task write permissions with 403", async () => {
    const caller = await createZeroPermissionUser("magic-polish-forbidden");
    await denyAllTaskWritePermissions(caller);

    const response = await request(app)
      .post(MAGIC_POLISH_URL)
      .set("Authorization", `Bearer ${caller.accessToken}`)
      .send({ title: "write report" });

    expect(response.status).toBe(403);
  });

  it("rejects a missing title with 400 and never calls the AI client", async () => {
    const caller = await createUserWithPermissions(["task:create"], "magic-polish-bad-body");
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    const response = await request(app)
      .post(MAGIC_POLISH_URL)
      .set("Authorization", `Bearer ${caller.accessToken}`)
      .send({ description: "no title here" });

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 503, not a raw upstream error, when the AI call fails", async () => {
    const caller = await createUserWithPermissions(["task:create"], "magic-polish-upstream-down");
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const response = await request(app)
      .post(MAGIC_POLISH_URL)
      .set("Authorization", `Bearer ${caller.accessToken}`)
      .send({ title: "write report" });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ statusCode: 503, error: "Service Unavailable" });
  });

  it("requires authentication", async () => {
    const response = await request(app).post(MAGIC_POLISH_URL).send({ title: "write report" });
    expect(response.status).toBe(401);
  });
});
