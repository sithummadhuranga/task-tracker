import pino from "pino";
import type { Env } from "../config/env.js";
import { env } from "../config/env.js";

// Exported separately from `logger` so the redact/serializer/transport choices are unit-testable
// without spinning up a real pino instance (pino.LoggerOptions has no meaningful equality check
// once constructed).
export function buildLoggerOptions(nodeEnv: Env["NODE_ENV"], logLevel: Env["LOG_LEVEL"]): pino.LoggerOptions {
  return {
    level: logLevel,
    // Auth tokens and session cookies must never reach a log sink, structured or otherwise.
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
      censor: "[Redacted]",
    },
    serializers: { err: pino.stdSerializers.err },
    ...(nodeEnv === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
          },
        }
      : {}),
  };
}

export const logger = pino(buildLoggerOptions(env.NODE_ENV, env.LOG_LEVEL));
