import { env } from "../config/env.js";
import { createRateLimiter } from "./rate-limit.js";

export const loginRateLimiter = createRateLimiter({
  routeKey: "auth-login",
  maxAttempts: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
});

export const registerRateLimiter = createRateLimiter({
  routeKey: "auth-register",
  maxAttempts: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
});

// Same reasonable-default threshold as login/register — refresh is a token-rotation endpoint
// an attacker could otherwise hammer freely, since it needs no password on each call, only the
// cookie. A legitimate session refreshes roughly once per access-token lifetime (15 min), well
// under this window's limit.
export const refreshRateLimiter = createRateLimiter({
  routeKey: "auth-refresh",
  maxAttempts: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
});
