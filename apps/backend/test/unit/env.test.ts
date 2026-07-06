import { parseEnv } from "../../src/common/config/env.js";

const VALID_ENV = {
  NODE_ENV: "test",
  PORT: "4000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/task_tracker",
  REDIS_URL: "redis://localhost:6379",
  CORS_ORIGIN: "http://localhost:5173",
  JWT_ACCESS_SECRET: "a".repeat(32),
};

describe("parseEnv", () => {
  it("parses a complete, valid environment and coerces PORT to a number", () => {
    const env = parseEnv(VALID_ENV);

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("test");
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
  });

  it("defaults PORT to 4000 and NODE_ENV to development when omitted", () => {
    const { PORT: _PORT, NODE_ENV: _NODE_ENV, ...rest } = VALID_ENV;
    const env = parseEnv(rest);

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("throws a clear, actionable error when a required var is missing", () => {
    const { DATABASE_URL: _DATABASE_URL, ...rest } = VALID_ENV;

    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when a required var is present but malformed", () => {
    expect(() => parseEnv({ ...VALID_ENV, DATABASE_URL: "not-a-url" })).toThrow(/DATABASE_URL/);
  });

  it("throws when JWT_ACCESS_SECRET is shorter than 32 characters", () => {
    expect(() => parseEnv({ ...VALID_ENV, JWT_ACCESS_SECRET: "too-short" })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});
