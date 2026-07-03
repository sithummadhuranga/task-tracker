import cors from "cors";
import express, { type Express } from "express";
import { env } from "./common/config/env.js";
import { errorHandler } from "./common/middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  // Ops plumbing for container/orchestrator healthchecks, not part of the public API surface.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(errorHandler);

  return app;
}
