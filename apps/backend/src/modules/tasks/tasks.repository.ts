import type { TaskStatus } from "@task-tracker/shared-types";
import { prisma } from "../../prisma/client.js";

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: Date;
  ownerId: string;
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
  update(id: string, data: UpdateTaskData): Promise<TaskRecord>;
  delete(id: string): Promise<void>;
}

// Deliberately excludes deletedAt — an internal soft-delete marker, never part of the public
// Task shape in docs/FEATURES_AND_API.md, so every query selects exactly this rather than
// relying on TaskRecord's type to hide a field Prisma would otherwise return at runtime.
const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  dueDate: true,
  ownerId: true,
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

  async update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    return prisma.task.update({ where: { id }, data, select: TASK_SELECT });
  }

  // Soft delete — the caller-visibility check (owner or task:delete:any) already happened via
  // findById before this runs, same as every other mutation in this repository.
  async delete(id: string): Promise<void> {
    await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
