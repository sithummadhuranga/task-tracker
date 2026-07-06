import request from "supertest";
import { createApp } from "../../src/app.js";
import { API_PREFIX } from "../../src/common/config/api-version.js";
import { redisClient } from "../../src/common/redis/client.js";
import { prisma } from "../../src/prisma/client.js";

const app = createApp();

// createApp() constructs the auth rate limiters, which kick off a fire-and-forget Redis Lua
// script load at import time — so this connection (and the Postgres one the register/login
// requests below use) needs closing just like every other e2e suite, or Jest never exits.
afterAll(async () => {
  await prisma.$disconnect();
  // ping() sits behind the script-load call in the same FIFO command queue, so awaiting it
  // guarantees that load has settled before we disconnect instead of racing it (an in-flight
  // load rejected by disconnect logs after Jest considers the file done and fails the run).
  await redisClient.ping().catch(() => undefined);
  redisClient.disconnect();
});

describe("security middleware", () => {
  it("sets helmet's baseline security headers on every response", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers).toHaveProperty("content-security-policy");
  });

  it("stamps every response with a unique x-request-id for log correlation", async () => {
    const [first, second] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/health"),
    ]);

    expect(first.headers["x-request-id"]).toEqual(expect.any(String));
    expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
  });

  it("rejects a JSON body over the configured size limit with 413, not a generic 500", async () => {
    const oversizedBody = JSON.stringify({ description: "x".repeat(20_000) });

    const response = await request(app)
      .post(`${API_PREFIX}/auth/register`)
      .set("Content-Type", "application/json")
      .send(oversizedBody);

    expect(response.status).toBe(413);
  });

  // Regression test for a real deploy-only bug: DigitalOcean's load balancer adds
  // X-Forwarded-For to every request, and express-rate-limit's own keyGenerator throws if it
  // sees that header while Express's "trust proxy" setting is unconfigured — which would have
  // 500'd every single login attempt in production despite passing every local/CI check, since
  // neither ever sends this header. Body is intentionally schema-invalid so this proves the
  // request clears the rate limiter's keyGenerator without depending on a database round trip.
  it("does not fail when a reverse-proxy X-Forwarded-For header is present on a rate-limited route", async () => {
    const response = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .set("X-Forwarded-For", "203.0.113.5")
      .send({ email: "not-an-email", password: "irrelevant1" });

    expect(response.status).toBe(400);
  });
});
