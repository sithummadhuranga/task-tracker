import { PERMISSION_KEYS } from "@task-tracker/shared-types";
import { z } from "zod";

export const createRoleSchema = z.object({ name: z.string().min(1) });
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const renameRoleSchema = z.object({ name: z.string().min(1).optional() });
export type RenameRoleInput = z.infer<typeof renameRoleSchema>;

export const replaceRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.enum(PERMISSION_KEYS)),
});
export type ReplaceRolePermissionsInput = z.infer<typeof replaceRolePermissionsSchema>;

export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().min(1)),
});
export type AssignUserRolesInput = z.infer<typeof assignUserRolesSchema>;
