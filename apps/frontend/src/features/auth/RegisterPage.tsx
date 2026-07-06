import { registerSchema } from "@task-tracker/shared-types";
import { useState, type SubmitEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/apiClient";
import { zodFieldErrors } from "../../lib/zodFieldErrors";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthContext";
import { FormBanner } from "./FormBanner";
import { FormField } from "./FormField";
import { SubmitButton } from "./SubmitButton";

export function RegisterPage() {
  const { register, status } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
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

    const result = registerSchema.safeParse({ email, password, name });
    if (!result.success) {
      setFieldErrors(zodFieldErrors(result.error));
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await register(result.data);
      await navigate("/login", { state: { justRegistered: true } });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout heading="Create your account" description="Start tracking tasks in under a minute.">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <FormField
          label="Name"
          value={name}
          onChange={setName}
          error={fieldErrors.name}
          autoComplete="name"
          disabled={isSubmitting}
        />
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
          autoComplete="new-password"
          disabled={isSubmitting}
        />
        {formError && <FormBanner tone="error">{formError}</FormBanner>}
        <SubmitButton isSubmitting={isSubmitting} label="Create account" loadingLabel="Creating account..." />
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:text-primary/80">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
