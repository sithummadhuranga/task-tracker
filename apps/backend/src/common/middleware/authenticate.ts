import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../errors/index.js";

export interface AuthenticatedUser {
  id: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- this is the documented way to augment Express's Request type
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("missing access token");
  }

  const token = header.slice("Bearer ".length);
  let payload: string | jwt.JwtPayload;

  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new UnauthorizedError("invalid or expired access token");
  }

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new UnauthorizedError("invalid access token");
  }

  req.user = { id: payload.sub };
  next();
}

// authenticate() always runs before a protected handler and guarantees req.user is set — but
// TypeScript can't see across that middleware boundary, so this narrows it without resorting
// to a non-null assertion at every call site.
export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError("authentication required");
  }

  return req.user;
}
