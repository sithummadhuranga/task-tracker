import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { API_PREFIX } from "./common/config/api-version.js";
import { env } from "./common/config/env.js";
import { errorHandler } from "./common/middleware/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Ops plumbing for container/orchestrator healthchecks, not part of the public API surface.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(`${API_PREFIX}/auth`, authRoutes);

  app.use(errorHandler);

  return app;
}
