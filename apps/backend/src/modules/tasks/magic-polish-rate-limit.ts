import { getAuthenticatedUser } from "../../common/middleware/authenticate.js";
import { createRateLimiter } from "../../common/middleware/rate-limit.js";
import { env } from "../../common/config/env.js";

// Keyed by user id, not IP — this sits behind `authenticate`, and what's being protected is
// per-account Gemini spend, not a per-network guessing surface (contrast with the IP-keyed
// limiters in auth-rate-limit.ts, which run before a user identity exists at all).
export const magicPolishRateLimiter = createRateLimiter({
  routeKey: "tasks-magic-polish",
  maxAttempts: env.MAGIC_POLISH_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs: env.MAGIC_POLISH_RATE_LIMIT_WINDOW_MS,
  keyGenerator: (req) => getAuthenticatedUser(req).id,
});
