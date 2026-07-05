import request from "supertest";
import { createApp } from "../../../src/app.js";
import { API_PREFIX } from "../../../src/common/config/api-version.js";
import { permissionsService } from "../../../src/modules/rbac/permissions.service.js";
import { prisma } from "../../../src/prisma/client.js";

export const app = createApp();
export const AUTH_BASE = `${API_PREFIX}/auth`;
export const ROLES_BASE = `${API_PREFIX}/roles`;
export const PERMISSIONS_BASE = `${API_PREFIX}/permissions`;
export const USERS_BASE = `${API_PREFIX}/users`;

interface LoginResponseBody {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

export interface FixtureUser {
  accessToken: string;
  userId: string;
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// A bad login shows up several requests later as "Cannot read properties of undefined" with
// no indication of what actually went wrong. Failing here, at the source, with the real status
// and body turns that into a one-line diagnosis instead of a stack trace pointing at the wrong line.
function assertLoginSucceeded(
  response: request.Response,
): asserts response is request.Response & { body: LoginResponseBody } {
  if (response.status !== 200) {
    throw new Error(
      `expected login to succeed, got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
}

async function registerAndLogin(label: string): Promise<FixtureUser> {
  const email = `${label}-${uniqueSuffix()}@example.com`;

  await request(app)
    .post(`${AUTH_BASE}/register`)
    .send({ email, password: "password1", name: "Fixture User" });

  const loginResponse = await request(app)
    .post(`${AUTH_BASE}/login`)
    .send({ email, password: "password1" });

  assertLoginSucceeded(loginResponse);

  return { accessToken: loginResponse.body.accessToken, userId: loginResponse.body.user.id };
}

// Registers a fresh user, then grants them a throwaway role holding exactly the given
// permissions — direct via prisma (bypassing the admin API under test, to avoid a circular
// test dependency) plus the matching Redis role-index write, since that's the one piece of
// bookkeeping the real assignUserRoles endpoint would also do and several tests need it in
// place to prove cache invalidation actually reaches this user.
export async function createUserWithPermissions(
  permissionKeys: string[],
  label = "fixture",
): Promise<FixtureUser & { roleId: string }> {
  const user = await registerAndLogin(label);

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });

  const role = await prisma.role.create({
    data: {
      name: `${label}-role-${uniqueSuffix()}`,
      isSystem: false,
      permissions: {
        create: permissions.map((permission) => ({ permissionId: permission.id })),
      },
    },
  });

  await prisma.userRole.create({ data: { userId: user.userId, roleId: role.id } });
  await permissionsService.addUserToRoleIndex(user.userId, role.id);

  return { ...user, roleId: role.id };
}

// A user with no role and no overrides — every requirePermission check must reject them.
export async function createZeroPermissionUser(label = "zero"): Promise<FixtureUser> {
  return registerAndLogin(label);
}

export interface FixtureSession extends FixtureUser {
  refreshCookie: string;
}

export async function registerAndLoginWithSession(label: string): Promise<FixtureSession> {
  const email = `${label}-${uniqueSuffix()}@example.com`;

  await request(app)
    .post(`${AUTH_BASE}/register`)
    .send({ email, password: "password1", name: "Fixture User" });

  const loginResponse = await request(app)
    .post(`${AUTH_BASE}/login`)
    .send({ email, password: "password1" });

  assertLoginSucceeded(loginResponse);
  const setCookie = loginResponse.headers["set-cookie"] as unknown as string[];
  const refreshCookie = setCookie.find((entry) => entry.startsWith("refresh_token="));

  if (!refreshCookie) {
    throw new Error("expected login to set a refresh_token cookie");
  }

  return {
    accessToken: loginResponse.body.accessToken,
    userId: loginResponse.body.user.id,
    refreshCookie,
  };
}

export async function loginAsAdmin(): Promise<FixtureUser> {
  const response = await request(app).post(`${AUTH_BASE}/login`).send({
    email: process.env.ADMIN_SEED_EMAIL ?? "",
    password: process.env.ADMIN_SEED_PASSWORD ?? "",
  });

  assertLoginSucceeded(response);

  return { accessToken: response.body.accessToken, userId: response.body.user.id };
}

export interface MeResponseBody {
  user: { id: string; email: string; name: string };
  roles: string[];
  permissions: string[];
}

export async function fetchMe(accessToken: string): Promise<MeResponseBody> {
  const response = await request(app)
    .get(`${AUTH_BASE}/me`)
    .set("Authorization", `Bearer ${accessToken}`);

  return response.body as MeResponseBody;
}
