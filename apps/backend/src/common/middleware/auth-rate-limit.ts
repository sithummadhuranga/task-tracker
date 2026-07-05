import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { env } from "../config/env.js";
import { TooManyRequestsError } from "../errors/index.js";
import { redisClient } from "../redis/client.js";

export interface AuthRateLimiterOptions {
  routeKey: string;
  maxAttempts: number;
  windowMs: number;
}

export function createAuthRateLimiter(options: AuthRateLimiterOptions): RateLimitRequestHandler {
  const { routeKey, maxAttempts, windowMs } = options;

  return rateLimit({
    windowMs,
    limit: maxAttempts,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      prefix: `rate-limit:${routeKey}:`,
      sendCommand: (...args: string[]) =>
        redisClient.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
    }),
    handler: () => {
      throw new TooManyRequestsError("too many attempts, try again later");
    },
  });
}

export const loginRateLimiter = createAuthRateLimiter({
  routeKey: "auth-login",
  maxAttempts: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
});

export const registerRateLimiter = createAuthRateLimiter({
  routeKey: "auth-register",
  maxAttempts: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
});
