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

const idsList = z
  .string()
  .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean));

// Not in the original locked contract — added with explicit user sign-off to let the frontend
// resolve a task's ownerId to a display name, since the Task response only ever carries the raw
// id. Exactly one of ids/q is required: ids resolves known owners for display (task:read:any OR
// user:manage), q powers the owner search-as-you-type picker in the task form.
export const userLookupQuerySchema = z
  .object({
    ids: idsList.optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .refine((value) => Boolean(value.ids?.length) !== Boolean(value.q), {
    message: "specify exactly one of ids or q",
  });
export type UserLookupQuery = z.infer<typeof userLookupQuerySchema>;
