import type { LoginInput, PermissionKey, RegisterInput } from "@task-tracker/shared-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

const REFRESH_ON_FOCUS_MIN_INTERVAL_MS = 10_000;

const UNAUTHENTICATED_STATE: AuthState = {
  status: "unauthenticated",
  user: null,
  roles: [],
  permissions: [],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...UNAUTHENTICATED_STATE, status: "loading" });
  const statusRef = useRef(state.status);
  const lastRefreshAt = useRef(0);

  // Kept in sync via an effect, not a direct assignment during render — the focus listener
  // below reads this ref instead of depending on `state.status` directly, precisely so it
  // doesn't need to be torn down and re-attached on every auth state change.
  useEffect(() => {
    statusRef.current = state.status;
  });

  const loadCurrentUser = useCallback(async () => {
    const me = await fetchCurrentUser();
    setState({ status: "authenticated", user: me.user, roles: me.roles, permissions: me.permissions });
  }, []);

  useEffect(() => {
    async function restoreSession(): Promise<void> {
      // The access token only ever lives in memory, so a page reload always needs a fresh
      // one from the refresh_token cookie before /me can be called.
      const restored = await refreshAccessToken();
      if (!restored) {
        setState(UNAUTHENTICATED_STATE);
        return;
      }

      try {
        await loadCurrentUser();
      } catch {
        // React 18+ discards state updates from an unmounted component silently, so there's
        // no unmounted-component guard here — it would just be dead defensiveness.
        setState(UNAUTHENTICATED_STATE);
      }
    }

    void restoreSession();
  }, [loadCurrentUser]);

  // Roles/permissions are only ever fetched once at login otherwise — an admin granting or
  // revoking access elsewhere would never reach an already-open tab without this. Refetching
  // on focus (rather than polling) is the standard, low-chatter way to catch that: the user
  // switching back to this tab is exactly the moment stale access would otherwise surface as
  // silently-missing UI. Throttled so rapid tab-switching doesn't spam /auth/me.
  useEffect(() => {
    function handleFocus(): void {
      if (statusRef.current !== "authenticated") {
        return;
      }
      const now = Date.now();
      if (now - lastRefreshAt.current < REFRESH_ON_FOCUS_MIN_INTERVAL_MS) {
        return;
      }
      lastRefreshAt.current = now;
      loadCurrentUser().catch(() => {
        setState(UNAUTHENTICATED_STATE);
      });
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
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
    } catch {
      // Server-side session revocation is best-effort — local state is cleared unconditionally
      // below, so a failed request here shouldn't surface as an uncaught rejection to callers.
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
