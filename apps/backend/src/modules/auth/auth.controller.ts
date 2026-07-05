import type { Request, Response } from "express";
import { API_PREFIX } from "../../common/config/api-version.js";
import { getAuthenticatedUser } from "../../common/middleware/authenticate.js";
import { authService } from "./auth.service.js";
import type { LoginInput, RegisterInput } from "./auth.dto.js";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

function getRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined>;
  return cookies[REFRESH_COOKIE_NAME];
}

export async function register(
  req: Request<object, unknown, RegisterInput>,
  res: Response,
): Promise<void> {
  const user = await authService.register(req.body);
  res.status(201).json(user);
}

export async function login(
  req: Request<object, unknown, LoginInput>,
  res: Response,
): Promise<void> {
  const { accessToken, refreshToken, user } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ accessToken, user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { accessToken, refreshToken } = await authService.refresh(getRefreshCookie(req));
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ accessToken });
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { id } = getAuthenticatedUser(req);
  await authService.logout(id, getRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  const { id } = getAuthenticatedUser(req);
  await authService.logoutAll(id);
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const { id } = getAuthenticatedUser(req);
  const result = await authService.me(id);
  res.status(200).json(result);
}
