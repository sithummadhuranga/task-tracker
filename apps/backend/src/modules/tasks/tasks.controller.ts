import type { Request, Response } from "express";
import { getAuthenticatedUser } from "../../common/middleware/authenticate.js";
import type { CreateTaskInput, TaskListQuery, UpdateTaskInput } from "./tasks.dto.js";
import { tasksService } from "./tasks.service.js";

// Record<string, never>, not object — object has no index signature, which makes it
// unassignable to the ParamsDictionary that getAuthenticatedUser expects below.
export async function createTask(
  req: Request<Record<string, never>, unknown, CreateTaskInput>,
  res: Response,
): Promise<void> {
  const { id: callerId } = getAuthenticatedUser(req);
  const task = await tasksService.createTask(callerId, req.body);
  res.status(201).json(task);
}

export async function getTask(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id: callerId } = getAuthenticatedUser(req);
  const task = await tasksService.getTask(callerId, req.params.id);
  res.status(200).json(task);
}

export async function listTasks(req: Request, res: Response): Promise<void> {
  const { id: callerId } = getAuthenticatedUser(req);
  // validate() has already replaced req.query with the coerced-and-defaulted TaskListQuery
  // shape by the time this handler runs.
  const query = req.query as unknown as TaskListQuery;
  const { tasks, total } = await tasksService.listTasks(callerId, query);

  res.status(200).json({
    data: tasks,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

export async function updateTask(
  req: Request<{ id: string }, unknown, UpdateTaskInput>,
  res: Response,
): Promise<void> {
  const { id: callerId } = getAuthenticatedUser(req);
  const task = await tasksService.updateTask(callerId, req.params.id, req.body);
  res.status(200).json(task);
}

export async function deleteTask(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id: callerId } = getAuthenticatedUser(req);
  await tasksService.deleteTask(callerId, req.params.id);
  res.status(204).send();
}
