import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requirePermission } from "../../common/middleware/requirePermission.js";
import { validate } from "../../common/middleware/validate.js";
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
