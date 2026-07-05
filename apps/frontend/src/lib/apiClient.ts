const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/v1`;

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details: ErrorResponseBody | null;

  constructor(statusCode: number, message: string, details: ErrorResponseBody | null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Deduped so that several requests hitting 401 at the same moment (e.g. `me` firing
// alongside a background call) trigger a single refresh instead of a stampede of them.
let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  refreshPromise ??= (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      accessToken = null;
      return false;
    }

    const body = (await response.json()) as { accessToken: string };
    accessToken = body.accessToken;
    return true;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ErrorResponseBody | null;
  const message = body
    ? Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message
    : response.statusText;
  return new ApiError(response.status, message, body);
}

async function send<T>(path: string, options: RequestOptions, isRetry: boolean): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && accessToken !== null && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return send<T>(path, options, true);
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => send<T>(path, { method: "GET" }, false),
  post: <T>(path: string, body?: unknown) => send<T>(path, { method: "POST", body }, false),
  patch: <T>(path: string, body?: unknown) => send<T>(path, { method: "PATCH", body }, false),
  delete: <T>(path: string) => send<T>(path, { method: "DELETE" }, false),
};
