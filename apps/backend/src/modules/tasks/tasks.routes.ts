import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requirePermission } from "../../common/middleware/requirePermission.js";
import { validate } from "../../common/middleware/validate.js";
import { magicPolishRateLimiter } from "./magic-polish-rate-limit.js";
import * as magicPolishController from "./magic-polish.controller.js";
import { magicPolishRequestSchema } from "./magic-polish.dto.js";
import * as tasksController from "./tasks.controller.js";
import { createTaskSchema, taskListQuerySchema, updateTaskSchema } from "./tasks.dto.js";

export const tasksRoutes = Router();

tasksRoutes.post(
  "/",
  authenticate,
  requirePermission("task:create"),
  validate(createTaskSchema),
  tasksController.createTask,
);

// No task id involved — this drafts text for a create/update body before it's ever submitted,
// so it's gated on "can this user write a task in some capacity" rather than a specific task's
// ownership. Same three keys as create/update, OR'd, deliberately not a dedicated permission
// key: this is a drafting aid to an existing write action, not its own business capability.
tasksRoutes.post(
  "/magic-polish",
  authenticate,
  requirePermission("task:create", "task:update:own", "task:update:any"),
  magicPolishRateLimiter,
  validate(magicPolishRequestSchema),
  magicPolishController.polishTask,
);

tasksRoutes.get(
  "/",
  authenticate,
  requirePermission("task:read:own", "task:read:any"),
  validate(taskListQuerySchema, "query"),
  tasksController.listTasks,
);

tasksRoutes.get(
  "/:id",
  authenticate,
  requirePermission("task:read:own", "task:read:any"),
  tasksController.getTask,
);

tasksRoutes.patch(
  "/:id",
  authenticate,
  requirePermission("task:update:own", "task:update:any"),
  validate(updateTaskSchema),
  tasksController.updateTask,
);

tasksRoutes.delete(
  "/:id",
  authenticate,
  requirePermission("task:delete:own", "task:delete:any"),
  tasksController.deleteTask,
);
