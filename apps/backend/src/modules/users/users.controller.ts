import type { Request, Response } from "express";
import { buildPaginationMeta } from "../../common/pagination.js";
import type { ListUsersQuery, UpsertPermissionOverrideInput, UserLookupQuery } from "./users.dto.js";
import { usersService } from "./users.service.js";

export async function listUsers(req: Request, res: Response): Promise<void> {
  // Express types req.query as ParsedQs regardless of route; the validate() middleware has
  // already replaced it with the coerced-and-defaulted shape by the time this handler runs.
  const { page, limit } = req.query as unknown as ListUsersQuery;
  const { users, total } = await usersService.listUsers({ page, limit });

  res.status(200).json({
    data: users,
    meta: buildPaginationMeta(page, limit, total),
  });
}

export async function lookupUsers(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as UserLookupQuery;
  const users = await usersService.lookupUsers(query);
  res.status(200).json(users);
}

export async function getUserDetail(req: Request<{ id: string }>, res: Response): Promise<void> {
  const user = await usersService.getUserDetail(req.params.id);
  res.status(200).json(user);
}

export async function upsertPermissionOverride(
  req: Request<{ id: string }, unknown, UpsertPermissionOverrideInput>,
  res: Response,
): Promise<void> {
  await usersService.upsertPermissionOverride(req.params.id, req.body);
  res.status(204).send();
}

export async function deletePermissionOverride(
  req: Request<{ id: string; permissionId: string }>,
  res: Response,
): Promise<void> {
  await usersService.deletePermissionOverride(req.params.id, req.params.permissionId);
  res.status(204).send();
}

export async function logoutAllForUser(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  await usersService.logoutAllForUser(req.params.id);
  res.status(204).send();
}
