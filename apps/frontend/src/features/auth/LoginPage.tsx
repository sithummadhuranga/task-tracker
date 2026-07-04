import { loginSchema } from "@task-tracker/shared-types";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/apiClient";
import { zodFieldErrors } from "../../lib/zodFieldErrors";
import { AuthCard } from "./AuthCard";
import { useAuth } from "./AuthContext";
import { FormField } from "./FormField";

interface LoginLocationState {
  from?: { pathname: string };
  justRegistered?: boolean;
}

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setFieldErrors(zodFieldErrors(result.error));
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await login(result.data);
      navigate(locationState?.from?.pathname ?? "/", { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to keep tracking your tasks.">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        {locationState?.justRegistered && (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            Account created. Sign in to continue.
          </p>
        )}
        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="email"
          disabled={isSubmitting}
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
          disabled={isSubmitting}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-400">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-400">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}
