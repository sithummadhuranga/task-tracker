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

export class PrismaTasksRepository implements TasksRepository {
  async create(data: CreateTaskData): Promise<TaskRecord> {
    return prisma.task.create({ data });
  }

  async findById(id: string): Promise<TaskRecord | null> {
    return prisma.task.findUnique({ where: { id } });
  }

  async findManyPaginated({ page, limit, status, ownerId }: TaskListFilter): Promise<PaginatedTasks> {
    const where = {
      ...(status ? { status } : {}),
      ...(ownerId ? { ownerId } : {}),
    };

    const [tasks, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.count({ where }),
    ]);

    return { tasks, total };
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    return prisma.task.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
  }
}
