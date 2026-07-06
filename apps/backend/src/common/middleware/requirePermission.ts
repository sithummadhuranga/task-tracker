import type { PermissionKey } from "@task-tracker/shared-types";
import type { NextFunction, Request, Response } from "express";
import { permissionsService } from "../../modules/rbac/permissions.service.js";
import { ForbiddenError, UnauthorizedError } from "../errors/index.js";

// Answers only "does the caller hold at least one of these keys at all" (OR semantics, e.g.
// "task:update:own OR task:update:any"). Ownership vs. permission is a second, independent
// check the resource's own service layer must still make — this middleware has no notion of
// which resource is being accessed, so it can't decide the 404-vs-403 masking on its own.
export function requirePermission(...keys: PermissionKey[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError("authentication required");
    }

    const effectivePermissions = await permissionsService.resolveEffectivePermissions(req.user.id);
    const hasAny = keys.some((key) => effectivePermissions.includes(key));

    if (!hasAny) {
      throw new ForbiddenError("insufficient permissions");
    }

    next();
  };
}
