import { z } from "zod";
import { TASK_STATUSES } from "./enums.js";

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).regex(/\d/, "password must contain at least one number"),
  name: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// dueDate accepts any ISO datetime string — past dates are allowed by design, a task can be
// created already overdue.
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: z.iso.datetime(),
  ownerId: z.uuid().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// version is required, not optional — it's the caller's optimistic-concurrency check-in, the
// exact value last read from a GET/list/create/update response. Making it skippable would let a
// client silently opt out of the conflict check the field exists to enforce.
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: z.iso.datetime().optional(),
  ownerId: z.uuid().optional(),
  version: z.number().int().min(1),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// Reuses createTaskSchema's own title/description bounds rather than restating the magic
// numbers — a polished result must always be resubmittable through the same create/update
// validation, so the two can never silently drift apart.
export const magicPolishRequestSchema = createTaskSchema.pick({ title: true, description: true });
export type MagicPolishRequest = z.infer<typeof magicPolishRequestSchema>;

// The model's own output is re-validated against these same bounds before it ever reaches a
// client — an upstream LLM is an untrusted external input like any other, not a shortcut around
// the limits a human-submitted body must satisfy. description has no .min(1): an empty string is
// a valid (if discouraged by the prompt) polished result, not a malformed one.
export const magicPolishResponseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
});
export type MagicPolishResponse = z.infer<typeof magicPolishResponseSchema>;

export const taskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  status: z.enum(TASK_STATUSES).optional(),
  ownerId: z.uuid().optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
