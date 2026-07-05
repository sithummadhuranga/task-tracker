import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requirePermission } from "../../common/middleware/requirePermission.js";
import { validate } from "../../common/middleware/validate.js";
import * as permissionsController from "./permissions.controller.js";
import {
  assignUserRolesSchema,
  createRoleSchema,
  renameRoleSchema,
  replaceRolePermissionsSchema,
} from "./rbac.dto.js";
import * as rolesController from "./roles.controller.js";

export const rbacRoutes = Router();

rbacRoutes.get(
  "/permissions",
  authenticate,
  requirePermission("role:manage", "permission:assign"),
  permissionsController.listCatalog,
);

rbacRoutes.get(
  "/roles",
  authenticate,
  requirePermission("role:manage"),
  rolesController.listRoles,
);

rbacRoutes.post(
  "/roles",
  authenticate,
  requirePermission("role:manage"),
  validate(createRoleSchema),
  rolesController.createRole,
);

rbacRoutes.patch(
  "/roles/:id",
  authenticate,
  requirePermission("role:manage"),
  validate(renameRoleSchema),
  rolesController.renameRole,
);

rbacRoutes.delete(
  "/roles/:id",
  authenticate,
  requirePermission("role:manage"),
  rolesController.deleteRole,
);

rbacRoutes.patch(
  "/roles/:id/permissions",
  authenticate,
  requirePermission("role:manage"),
  validate(replaceRolePermissionsSchema),
  rolesController.replaceRolePermissions,
);

// Deliberately role:manage, not user:manage — assigning roles is treated as a role-management
// action per the locked contract, even though the URL nests under /users.
rbacRoutes.post(
  "/users/:id/roles",
  authenticate,
  requirePermission("role:manage"),
  validate(assignUserRolesSchema),
  rolesController.assignUserRoles,
);
