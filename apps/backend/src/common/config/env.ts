import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  CORS_ORIGIN: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Optional — an empty string (e.g. an unset GitHub Actions secret substituted into a docker-
  // compose env var) is normalized to undefined rather than failing `.min(1)`, so the feature is
  // genuinely opt-in: the app boots and every other endpoint works with this unset, and only
  // POST /tasks/magic-polish itself reports 503 until a key is provided.
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  // Deliberately not a hardcoded constant — Google renames/deprecates model tiers periodically,
  // and this lets that be a config change instead of a code change + redeploy.
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  MAGIC_POLISH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(20),
  MAGIC_POLISH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
});

export function parseEnv(rawEnv: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }

  return parsed.data;
}

export const env = parseEnv(process.env);
export type Env = typeof env;
