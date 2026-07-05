import { loginSchema } from "@task-tracker/shared-types";
import { useState, type SubmitEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/apiClient";
import { zodFieldErrors } from "../../lib/zodFieldErrors";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthContext";
import { FormBanner } from "./FormBanner";
import { FormField } from "./FormField";
import { SubmitButton } from "./SubmitButton";

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

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
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
      await navigate(locationState?.from?.pathname ?? "/", { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Invalid credentials");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout heading="Sign in" description="Welcome back — pick up right where you left off.">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {locationState?.justRegistered && (
          <FormBanner tone="success">Account created. Sign in to continue.</FormBanner>
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
        {formError && <FormBanner tone="error">{formError}</FormBanner>}
        <SubmitButton isSubmitting={isSubmitting} label="Sign in" loadingLabel="Signing in..." />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-primary hover:text-primary/80">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
