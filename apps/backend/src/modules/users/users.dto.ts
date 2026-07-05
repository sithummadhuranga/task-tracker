import { PERMISSION_EFFECTS, PERMISSION_KEYS } from "@task-tracker/shared-types";
import { z } from "zod";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const upsertPermissionOverrideSchema = z.object({
  permissionKey: z.enum(PERMISSION_KEYS),
  effect: z.enum(PERMISSION_EFFECTS),
});
export type UpsertPermissionOverrideInput = z.infer<typeof upsertPermissionOverrideSchema>;
