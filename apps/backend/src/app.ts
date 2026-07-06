import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { API_PREFIX } from "./common/config/api-version.js";
import { env } from "./common/config/env.js";
import { requestLogger } from "./common/logging/request-logger.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { rbacRoutes } from "./modules/rbac/rbac.routes.js";
import { tasksRoutes } from "./modules/tasks/tasks.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";

export function createApp(): Express {
  const app = express();

  // 1, not true — DigitalOcean App Platform's load balancer is exactly one hop in front of
  // this container. `true` would trust the whole X-Forwarded-For chain, letting any client
  // spoof its own IP and bypass the per-IP auth rate limiter below.
  app.set("trust proxy", 1);

  // Express generates a weak ETag on every response by default — meant for static/cacheable
  // content, not a live JSON API. A repeat GET with a matching If-None-Match then gets a bare
  // 304 with no body, which every client here (fetch's response.ok, Jest/Supertest assertions)
  // correctly treats as "not 2xx" since it isn't the data the caller asked for.
  app.set("etag", false);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  // Ops plumbing for container/orchestrator healthchecks, not part of the public API surface.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(API_PREFIX, rbacRoutes);
  app.use(`${API_PREFIX}/users`, usersRoutes);
  app.use(`${API_PREFIX}/tasks`, tasksRoutes);

  app.use(errorHandler);

  return app;
}
