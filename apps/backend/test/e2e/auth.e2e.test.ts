import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/prisma/client.js";
import { redisClient } from "../../src/common/redis/client.js";

const app = createApp();

interface LoginResponseBody {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

interface MeResponseBody {
  user: { id: string; email: string; name: string };
  roles: string[];
  permissions: string[];
}

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

async function registerAndLogin(email: string) {
  await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password1", name: "Test User" });

  const loginResponse = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password1" });

  const setCookie = loginResponse.headers["set-cookie"] as unknown as string[];
  const cookie = setCookie.find((entry) => entry.startsWith("refresh_token="));

  if (!cookie) {
    throw new Error("expected login to set a refresh_token cookie");
  }

  const body = loginResponse.body as LoginResponseBody;

  return {
    accessToken: body.accessToken,
    refreshCookie: cookie.split(";")[0] ?? "",
  };
}

afterAll(async () => {
  await prisma.$disconnect();
  redisClient.disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates a user and never returns the password hash", async () => {
    const email = uniqueEmail("register-happy");

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password1", name: "Jane Doe" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ email, name: "Jane Doe" });
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail("register-dup");
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password1", name: "Jane" });

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password1", name: "Jane" });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, error: "Conflict" });
  });

  it("rejects a malformed body with 400", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: uniqueEmail("register-bad"), password: "short", name: "Jane" });

    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("issues an access token and a properly-flagged refresh cookie on success", async () => {
    const email = uniqueEmail("login-happy");
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password1", name: "Jane" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password1" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).not.toHaveProperty("refreshToken");

    const setCookie = (response.headers["set-cookie"] as unknown as string[]).join(";");
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
  });

  it("rejects an unknown email with the generic invalid-credentials message", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail("no-such-user"), password: "password1" });

    expect(response.status).toBe(401);
    expect((response.body as ErrorResponseBody).message).toBe("invalid credentials");
  });

  it("rejects a wrong password with the identical generic message", async () => {
    const email = uniqueEmail("login-wrong-pw");
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "password1", name: "Jane" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong-password1" });

    expect(response.status).toBe(401);
    expect((response.body as ErrorResponseBody).message).toBe("invalid credentials");
  });
});

describe("POST /api/auth/refresh", () => {
  it("rejects a request with no refresh cookie", async () => {
    const response = await request(app).post("/api/auth/refresh");
    expect(response.status).toBe(401);
  });

  it("rotates a valid refresh token and issues a new access token", async () => {
    const { refreshCookie } = await registerAndLogin(uniqueEmail("refresh-happy"));

    const response = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect((response.headers["set-cookie"] as unknown as string[]).join(";")).toContain(
      "refresh_token=",
    );
  });

  it("treats reuse of an already-rotated token as theft and revokes every session", async () => {
    const { refreshCookie } = await registerAndLogin(uniqueEmail("refresh-reuse"));

    const firstRefresh = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
    const rotatedCookie = (firstRefresh.headers["set-cookie"] as unknown as string[])
      .find((entry) => entry.startsWith("refresh_token="))
      ?.split(";")[0];

    // Replaying the original (now-superseded) cookie is the reuse/theft signal.
    const reuseAttempt = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
    expect(reuseAttempt.status).toBe(401);

    // The legitimately-rotated token must be revoked too, not just the reused one.
    const followUp = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", rotatedCookie ?? "");
    expect(followUp.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("requires a valid access token", async () => {
    const response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(401);
  });

  it("revokes the current session so its refresh cookie stops working", async () => {
    const { accessToken, refreshCookie } = await registerAndLogin(uniqueEmail("logout-happy"));

    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie);
    expect(logoutResponse.status).toBe(204);

    const refreshAfterLogout = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe("POST /api/auth/logout-all", () => {
  it("requires a valid access token", async () => {
    const response = await request(app).post("/api/auth/logout-all");
    expect(response.status).toBe(401);
  });

  it("revokes every session for the user, not just the current one", async () => {
    const email = uniqueEmail("logout-all-happy");
    const first = await registerAndLogin(email);
    const secondLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password1" });
    const secondCookie = (secondLogin.headers["set-cookie"] as unknown as string[])
      .find((entry) => entry.startsWith("refresh_token="))
      ?.split(";")[0];

    await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${first.accessToken}`);

    const refreshFirst = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", first.refreshCookie);
    const refreshSecond = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", secondCookie ?? "");

    expect(refreshFirst.status).toBe(401);
    expect(refreshSecond.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("requires a valid access token", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("rejects a malformed access token", async () => {
    const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer garbage");
    expect(response.status).toBe(401);
  });

  it("returns the user, roles, and the default USER permission set", async () => {
    const { accessToken } = await registerAndLogin(uniqueEmail("me-happy"));

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    const body = response.body as MeResponseBody;

    expect(response.status).toBe(200);
    expect(body.roles).toEqual(["USER"]);
    expect(body.permissions.sort()).toEqual(
      ["task:create", "task:delete:own", "task:read:own", "task:update:own"].sort(),
    );
    expect(body.user).toMatchObject({ name: "Test User" });
  });
});
