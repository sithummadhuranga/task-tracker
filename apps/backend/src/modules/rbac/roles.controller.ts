import type { Request, Response } from "express";
import type {
  AssignUserRolesInput,
  CreateRoleInput,
  RenameRoleInput,
  ReplaceRolePermissionsInput,
} from "./rbac.dto.js";
import { rolesService } from "./roles.service.js";

export async function listRoles(_req: Request, res: Response): Promise<void> {
  const roles = await rolesService.listRoles();
  res.status(200).json(roles);
}

export async function createRole(
  req: Request<object, unknown, CreateRoleInput>,
  res: Response,
): Promise<void> {
  const role = await rolesService.createRole(req.body.name);
  res.status(201).json(role);
}

export async function renameRole(
  req: Request<{ id: string }, unknown, RenameRoleInput>,
  res: Response,
): Promise<void> {
  const role = await rolesService.renameRole(req.params.id, req.body.name);
  res.status(200).json(role);
}

export async function deleteRole(req: Request<{ id: string }>, res: Response): Promise<void> {
  await rolesService.deleteRole(req.params.id);
  res.status(204).send();
}

export async function replaceRolePermissions(
  req: Request<{ id: string }, unknown, ReplaceRolePermissionsInput>,
  res: Response,
): Promise<void> {
  await rolesService.replaceRolePermissions(req.params.id, req.body.permissionKeys);
  res.status(204).send();
}

export async function assignUserRoles(
  req: Request<{ id: string }, unknown, AssignUserRolesInput>,
  res: Response,
): Promise<void> {
  await rolesService.assignUserRoles(req.params.id, req.body.roleIds);
  res.status(204).send();
}
