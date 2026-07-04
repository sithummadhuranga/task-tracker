import type { LoginInput, PermissionKey, RegisterInput } from "@task-tracker/shared-types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { refreshAccessToken, setAccessToken } from "../../lib/apiClient";
import { hasPermission as checkPermission } from "../../lib/permissions";
import { fetchCurrentUser, loginUser, logoutUser, registerUser, type AuthUser } from "./auth.api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
}

interface AuthContextValue extends AuthState {
  // Property (arrow) function types, not method shorthand — these are destructured directly
  // by consumers (`const { login } = useAuth()`), and method shorthand trips up
  // @typescript-eslint/unbound-method on every call site.
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (...keys: PermissionKey[]) => boolean;
}

const UNAUTHENTICATED_STATE: AuthState = {
  status: "unauthenticated",
  user: null,
  roles: [],
  permissions: [],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...UNAUTHENTICATED_STATE, status: "loading" });

  const loadCurrentUser = useCallback(async () => {
    const me = await fetchCurrentUser();
    setState({ status: "authenticated", user: me.user, roles: me.roles, permissions: me.permissions });
  }, []);

  useEffect(() => {
    let isActive = true;

    async function restoreSession(): Promise<void> {
      // The access token only ever lives in memory, so a page reload always needs a fresh
      // one from the refresh_token cookie before /me can be called.
      const restored = await refreshAccessToken();
      if (!isActive) {
        return;
      }
      if (!restored) {
        setState(UNAUTHENTICATED_STATE);
        return;
      }

      try {
        await loadCurrentUser();
      } catch {
        if (isActive) {
          setState(UNAUTHENTICATED_STATE);
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, [loadCurrentUser]);

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await loginUser(input);
      setAccessToken(result.accessToken);
      await loadCurrentUser();
    },
    [loadCurrentUser],
  );

  const register = useCallback(async (input: RegisterInput) => {
    await registerUser(input);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setAccessToken(null);
      setState(UNAUTHENTICATED_STATE);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      hasPermission: (...keys: PermissionKey[]) => checkPermission(state.permissions, ...keys),
    }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
