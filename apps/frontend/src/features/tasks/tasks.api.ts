import type { TaskStatus } from "@task-tracker/shared-types";
import { apiClient } from "../../lib/apiClient";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTasks {
  data: Task[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface TaskListParams {
  page: number;
  limit: number;
  status?: TaskStatus;
  ownerId?: string;
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDate: string;
  ownerId?: string;
}

export interface UpdateTaskBody {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
  ownerId?: string;
}

function buildTaskListQueryString(params: TaskListParams): string {
  const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.status) {
    query.set("status", params.status);
  }
  if (params.ownerId) {
    query.set("ownerId", params.ownerId);
  }
  return query.toString();
}

export function fetchTasks(params: TaskListParams): Promise<PaginatedTasks> {
  return apiClient.get(`/tasks?${buildTaskListQueryString(params)}`);
}

export function fetchTask(id: string): Promise<Task> {
  return apiClient.get(`/tasks/${id}`);
}

export function createTask(body: CreateTaskBody): Promise<Task> {
  return apiClient.post("/tasks", body);
}

export function updateTask(id: string, body: UpdateTaskBody): Promise<Task> {
  return apiClient.patch(`/tasks/${id}`, body);
}

export function deleteTask(id: string): Promise<void> {
  return apiClient.delete(`/tasks/${id}`);
}

export interface UserLookupResult {
  id: string;
  name: string;
  email: string;
}

// Backend addition made alongside this feature (see docs/FEATURES_AND_API.md's GET
// /users/lookup entry) — resolves ownerId -> {name, email} for display, and powers the
// search-as-you-type owner picker. Gated on task:read:any OR user:manage, same as the task
// endpoints that need it.
export function lookupUsersByIds(ids: string[]): Promise<UserLookupResult[]> {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return apiClient.get(`/users/lookup?ids=${encodeURIComponent(ids.join(","))}`);
}

export function searchUsers(query: string): Promise<UserLookupResult[]> {
  return apiClient.get(`/users/lookup?q=${encodeURIComponent(query)}`);
}
