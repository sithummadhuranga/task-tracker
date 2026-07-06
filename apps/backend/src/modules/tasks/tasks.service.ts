import type { CreateTaskInput, TaskListQuery, UpdateTaskInput } from "@task-tracker/shared-types";
import { ConflictError, NotFoundError } from "../../common/errors/index.js";
import { permissionsService, type PermissionsService } from "../rbac/permissions.service.js";
import { taskEventsEmitter, type TaskEventsEmitter } from "../../websocket/events.js";
import {
  PrismaTasksRepository,
  type PaginatedTasks,
  type TaskRecord,
  type TasksRepository,
  type UpdateTaskData,
} from "./tasks.repository.js";

export type TaskPermissionsResolver = Pick<PermissionsService, "resolveEffectivePermissions">;
export type TaskEventNotifier = Pick<TaskEventsEmitter, "emit">;

export class TasksService {
  constructor(
    private readonly repository: TasksRepository = new PrismaTasksRepository(),
    private readonly permissions: TaskPermissionsResolver = permissionsService,
    private readonly events: TaskEventNotifier = taskEventsEmitter,
  ) {}

  // task:read:any is the deliberate admin-scope gate for naming an arbitrary owner on create —
  // there is no separate task:create:any key in the permission catalog.
  async createTask(callerId: string, input: CreateTaskInput): Promise<TaskRecord> {
    const canAssignArbitraryOwner = await this.hasPermission(callerId, "task:read:any");
    const ownerId = canAssignArbitraryOwner && input.ownerId ? input.ownerId : callerId;

    const task = await this.repository.create({
      title: input.title,
      description: input.description,
      status: input.status ?? "TODO",
      dueDate: new Date(input.dueDate),
      ownerId,
    });

    this.events.emit("task.created", task);
    return task;
  }

  async getTask(callerId: string, taskId: string): Promise<TaskRecord> {
    const canReadAny = await this.hasPermission(callerId, "task:read:any");
    const task = await this.repository.findById(taskId);

    return this.requireVisibleTask(task, callerId, canReadAny);
  }

  async listTasks(callerId: string, query: TaskListQuery): Promise<PaginatedTasks> {
    const canReadAny = await this.hasPermission(callerId, "task:read:any");
    const ownerId = canReadAny ? query.ownerId : callerId;

    return this.repository.findManyPaginated({
      page: query.page,
      limit: query.limit,
      status: query.status,
      ownerId,
    });
  }

  async updateTask(callerId: string, taskId: string, input: UpdateTaskInput): Promise<TaskRecord> {
    const canUpdateAny = await this.hasPermission(callerId, "task:update:any");
    const existing = await this.repository.findById(taskId);
    const task = this.requireVisibleTask(existing, callerId, canUpdateAny);

    // ownerId is stripped, not rejected, for a caller without task:update:any — consistent
    // with how the create/list endpoints handle the same admin-scope field elsewhere in this
    // contract (silently overridden rather than a validation error). version is likewise pulled
    // out here — it's the concurrency check-in, not a column being written.
    const { ownerId, dueDate, version, ...rest } = input;
    const updateData: UpdateTaskData = {
      ...rest,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      ...(canUpdateAny && ownerId ? { ownerId } : {}),
    };

    const updated = await this.repository.update(task.id, version, updateData);

    if (!updated) {
      throw new ConflictError("task was changed since you last loaded it — reload and try again");
    }

    this.events.emit("task.updated", updated);
    return updated;
  }

  async deleteTask(callerId: string, taskId: string): Promise<void> {
    const canDeleteAny = await this.hasPermission(callerId, "task:delete:any");
    const existing = await this.repository.findById(taskId);
    const task = this.requireVisibleTask(existing, callerId, canDeleteAny);

    await this.repository.delete(task.id);
    this.events.emit("task.deleted", task);
  }

  private async hasPermission(callerId: string, key: string): Promise<boolean> {
    const effectivePermissions = await this.permissions.resolveEffectivePermissions(callerId);
    return effectivePermissions.includes(key);
  }

  // A task that exists but belongs to someone else, and a task that doesn't exist at all, must
  // produce the identical NotFoundError — otherwise the response itself leaks which case it was.
  private requireVisibleTask(
    task: TaskRecord | null,
    callerId: string,
    hasAnyScope: boolean,
  ): TaskRecord {
    if (!task || (!hasAnyScope && task.ownerId !== callerId)) {
      throw new NotFoundError("task not found");
    }

    return task;
  }
}

export const tasksService = new TasksService();
