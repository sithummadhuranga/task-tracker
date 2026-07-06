import request from "supertest";
import { createApp } from "../../src/app.js";
import { redisClient } from "../../src/common/redis/client.js";

// createApp() wires up the auth routes, whose rate limiters connect to Redis (to load their
// Lua scripts) the moment the module graph is imported — before any request is ever made. This
// file never issues a rate-limited request itself, so without this it'd leak that connection and
// leave Jest unable to exit, exactly like every other e2e suite that talks to Redis.
afterAll(async () => {
  // ping() sits behind the script-load call in the same FIFO command queue, so awaiting it
  // guarantees that load has settled before we disconnect instead of racing it (an in-flight
  // load rejected by disconnect logs after Jest considers the file done and fails the run).
  await redisClient.ping().catch(() => undefined);
  redisClient.disconnect();
});

describe("GET /health", () => {
  const app = createApp();

  it("returns 200 with an ok status body", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
