import type { PermissionKey } from "@task-tracker/shared-types";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface RequirePermissionProps {
  anyOf: PermissionKey[];
  children: ReactNode;
}

export function RequirePermission({ anyOf, children }: RequirePermissionProps) {
  const { status, hasPermission } = useAuth();

  // Mirrors RequireAuth's own loading guard — without it, this decides against an empty
  // `permissions` array during the brief window before /auth/me resolves and redirects a
  // legitimate admin away. Since <Navigate> is a one-shot effect, that redirect wouldn't
  // self-correct once the real permissions load a moment later.
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-ink">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!hasPermission(...anyOf)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
