import request from "supertest";
import { createApp } from "../../src/app.js";

describe("GET /health", () => {
  const app = createApp();

  it("returns 200 with an ok status body", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
