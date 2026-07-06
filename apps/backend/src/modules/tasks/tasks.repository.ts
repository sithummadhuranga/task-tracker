import type { TaskStatus } from "@task-tracker/shared-types";
import { prisma } from "../../prisma/client.js";

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: Date;
  ownerId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate: Date;
  ownerId: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: Date;
  ownerId?: string;
}

export interface TaskListFilter {
  page: number;
  limit: number;
  status?: TaskStatus;
  ownerId?: string;
}

export interface PaginatedTasks {
  tasks: TaskRecord[];
  total: number;
}

export interface TasksRepository {
  create(data: CreateTaskData): Promise<TaskRecord>;
  findById(id: string): Promise<TaskRecord | null>;
  findManyPaginated(filter: TaskListFilter): Promise<PaginatedTasks>;
  // Returns null, rather than throwing, when expectedVersion doesn't match the row's current
  // version (or the row was concurrently soft-deleted) — the caller has already confirmed the
  // task exists and is visible to them, so a null result here means "conflict", not "not found".
  update(id: string, expectedVersion: number, data: UpdateTaskData): Promise<TaskRecord | null>;
  delete(id: string): Promise<void>;
}

// Deliberately excludes deletedAt — an internal soft-delete marker, never part of the public
// Task shape, so every query selects exactly this rather than relying on TaskRecord's type to
// hide a field Prisma would otherwise return at runtime.
const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  dueDate: true,
  ownerId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaTasksRepository implements TasksRepository {
  async create(data: CreateTaskData): Promise<TaskRecord> {
    return prisma.task.create({ data, select: TASK_SELECT });
  }

  async findById(id: string): Promise<TaskRecord | null> {
    return prisma.task.findUnique({ where: { id, deletedAt: null }, select: TASK_SELECT });
  }

  async findManyPaginated({ page, limit, status, ownerId }: TaskListFilter): Promise<PaginatedTasks> {
    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(ownerId ? { ownerId } : {}),
    };

    const [tasks, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        select: TASK_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.count({ where }),
    ]);

    return { tasks, total };
  }

  // A conditional updateMany, not update — Prisma's update() can't add a where condition beyond
  // the unique key, but the version check needs one. deletedAt: null is included in the same
  // where so a concurrent soft-delete can't be resurrected by a racing update.
  async update(id: string, expectedVersion: number, data: UpdateTaskData): Promise<TaskRecord | null> {
    const result = await prisma.task.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.task.findUniqueOrThrow({ where: { id }, select: TASK_SELECT });
  }

  // Soft delete — the caller-visibility check (owner or task:delete:any) already happened via
  // findById before this runs, same as every other mutation in this repository.
  async delete(id: string): Promise<void> {
    await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
