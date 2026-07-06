import type { PermissionEffect, PermissionKey } from "@task-tracker/shared-types";
import { apiClient } from "../../lib/apiClient";

export interface PermissionCatalogEntry {
  id: string;
  key: PermissionKey;
}

export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
  createdAt: string;
  permissionKeys: PermissionKey[];
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  roles: string[];
}

export interface PaginatedUsers {
  data: UserSummary[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PermissionOverride {
  id: string;
  permissionKey: PermissionKey;
  effect: PermissionEffect;
}

export interface UserDetail {
  user: { id: string; email: string; name: string; createdAt: string; updatedAt: string };
  roles: string[];
  overrides: PermissionOverride[];
}

export function fetchPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
  return apiClient.get("/permissions");
}

export function fetchRoles(): Promise<RoleSummary[]> {
  return apiClient.get("/roles");
}

export function createRole(name: string): Promise<RoleSummary> {
  return apiClient.post("/roles", { name });
}

export function renameRole(id: string, name: string): Promise<RoleSummary> {
  return apiClient.patch(`/roles/${id}`, { name });
}

export function deleteRole(id: string): Promise<void> {
  return apiClient.delete(`/roles/${id}`);
}

export function replaceRolePermissions(id: string, permissionKeys: PermissionKey[]): Promise<void> {
  return apiClient.patch(`/roles/${id}/permissions`, { permissionKeys });
}

export function assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
  return apiClient.post(`/users/${userId}/roles`, { roleIds });
}

export function fetchUsers(page: number, limit: number): Promise<PaginatedUsers> {
  return apiClient.get(`/users?page=${page}&limit=${limit}`);
}

export function fetchUserDetail(id: string): Promise<UserDetail> {
  return apiClient.get(`/users/${id}`);
}

export function upsertPermissionOverride(
  userId: string,
  permissionKey: PermissionKey,
  effect: PermissionEffect,
): Promise<void> {
  return apiClient.post(`/users/${userId}/permissions`, { permissionKey, effect });
}

export function deletePermissionOverride(userId: string, permissionOverrideId: string): Promise<void> {
  return apiClient.delete(`/users/${userId}/permissions/${permissionOverrideId}`);
}

export function logoutAllForUser(userId: string): Promise<void> {
  return apiClient.post(`/users/${userId}/logout-all`);
}
