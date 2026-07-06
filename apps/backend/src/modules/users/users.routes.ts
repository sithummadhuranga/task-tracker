import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requirePermission } from "../../common/middleware/requirePermission.js";
import { validate } from "../../common/middleware/validate.js";
import * as usersController from "./users.controller.js";
import { listUsersQuerySchema, upsertPermissionOverrideSchema, userLookupQuerySchema } from "./users.dto.js";

export const usersRoutes = Router();

// POST /:id/roles is intentionally not defined here — it's a role:manage-owned action per the
// locked contract and lives in rbac.routes.ts alongside the role-index bookkeeping it needs.

usersRoutes.get(
  "/",
  authenticate,
  requirePermission("user:manage"),
  validate(listUsersQuerySchema, "query"),
  usersController.listUsers,
);

// Must be registered before GET /:id — otherwise Express would match "lookup" as the :id param.
// Gated on task:read:any as well as user:manage since this exists to let a task-scoped admin
// resolve/search task owners without also requiring the separate user:manage permission.
usersRoutes.get(
  "/lookup",
  authenticate,
  requirePermission("task:read:any", "user:manage"),
  validate(userLookupQuerySchema, "query"),
  usersController.lookupUsers,
);

usersRoutes.get(
  "/:id",
  authenticate,
  requirePermission("user:manage"),
  usersController.getUserDetail,
);

usersRoutes.post(
  "/:id/permissions",
  authenticate,
  requirePermission("permission:assign"),
  validate(upsertPermissionOverrideSchema),
  usersController.upsertPermissionOverride,
);

usersRoutes.delete(
  "/:id/permissions/:permissionId",
  authenticate,
  requirePermission("permission:assign"),
  usersController.deletePermissionOverride,
);

usersRoutes.post(
  "/:id/logout-all",
  authenticate,
  requirePermission("user:manage"),
  usersController.logoutAllForUser,
);
