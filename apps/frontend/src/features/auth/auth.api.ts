import type { LoginInput, RegisterInput } from "@task-tracker/shared-types";
import { apiClient } from "../../lib/apiClient";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface RegisteredUser extends AuthUser {
  createdAt: string;
  updatedAt: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export interface MeResult {
  user: AuthUser;
  roles: string[];
  permissions: string[];
}

export function registerUser(input: RegisterInput): Promise<RegisteredUser> {
  return apiClient.post<RegisteredUser>("/api/auth/register", input);
}

export function loginUser(input: LoginInput): Promise<LoginResult> {
  return apiClient.post<LoginResult>("/api/auth/login", input);
}

export async function logoutUser(): Promise<void> {
  await apiClient.post("/api/auth/logout");
}

export function fetchCurrentUser(): Promise<MeResult> {
  return apiClient.get<MeResult>("/api/auth/me");
}
