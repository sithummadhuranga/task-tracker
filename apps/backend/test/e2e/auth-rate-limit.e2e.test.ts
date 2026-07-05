import express from "express";
import request from "supertest";
import { createAuthRateLimiter } from "../../src/common/middleware/auth-rate-limit.js";
import { errorHandler } from "../../src/common/middleware/error-handler.js";
import { redisClient } from "../../src/common/redis/client.js";

// A throwaway host app around just the limiter under test — the real auth routes share one
// production-configured limiter (env.AUTH_RATE_LIMIT_MAX_ATTEMPTS, relaxed for the rest of the
// e2e suite so dozens of unrelated register/login calls don't trip it), so proving the 429
// boundary itself needs its own small, explicit threshold instead.
function buildProbeApp(routeKey: string, maxAttempts: number) {
  const limiter = createAuthRateLimiter({ routeKey, maxAttempts, windowMs: 60_000 });
  const app = express();
  app.post("/probe", limiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

function uniqueRouteKey(label: string): string {
  return `test-${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

afterAll(() => {
  redisClient.disconnect();
});

describe("createAuthRateLimiter", () => {
  it("allows requests up to the limit and rejects the next one with 429", async () => {
    const app = buildProbeApp(uniqueRouteKey("boundary"), 2);

    const first = await request(app).post("/probe");
    const second = await request(app).post("/probe");
    const third = await request(app).post("/probe");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({ statusCode: 429, error: "Too Many Requests" });
  });

  it("tracks distinct route keys independently, e.g. login vs register", async () => {
    const loginApp = buildProbeApp(uniqueRouteKey("login"), 1);
    const registerApp = buildProbeApp(uniqueRouteKey("register"), 1);

    const loginFirst = await request(loginApp).post("/probe");
    const registerFirst = await request(registerApp).post("/probe");
    const loginSecond = await request(loginApp).post("/probe");

    expect(loginFirst.status).toBe(200);
    expect(registerFirst.status).toBe(200);
    expect(loginSecond.status).toBe(429);
  });
});
