import type { Request } from "express";
import { rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { TooManyRequestsError } from "../errors/index.js";
import { redisClient } from "../redis/client.js";

export interface RateLimiterOptions {
  routeKey: string;
  maxAttempts: number;
  windowMs: number;
  // Defaults to express-rate-limit's own IP-based key — override for authenticated routes where
  // the thing being protected is per-account spend/abuse, not a per-network guessing surface.
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimitRequestHandler {
  const { routeKey, maxAttempts, windowMs, keyGenerator } = options;

  return rateLimit({
    windowMs,
    limit: maxAttempts,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
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
