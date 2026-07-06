// Runs before each test file's modules are imported, so common/config/env.ts sees a valid
// environment even when a real .env isn't present (e.g. unit tests, local `jest` runs).
process.env.NODE_ENV ??= "test";
process.env.PORT ??= "4000";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/task_tracker_test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.JWT_ACCESS_SECRET ??= "test-only-secret-value-not-used-in-production-00000000";
process.env.ADMIN_SEED_EMAIL ??= "admin@test-tasktracker.local";
process.env.ADMIN_SEED_PASSWORD ??= "test-only-admin-password-1";
// e2e suites share one Redis instance and one loopback IP across dozens of register/login
// calls per run — a production-sized limit would trip mid-suite on unrelated tests. The
// dedicated auth-rate-limit unit test builds its own limiter with an explicit low threshold
// instead of relying on this value, so real 429 behavior still gets exercised.
process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS ??= "1000";
