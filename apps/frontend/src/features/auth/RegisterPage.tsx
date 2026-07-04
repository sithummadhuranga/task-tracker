import { registerSchema } from "@task-tracker/shared-types";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/apiClient";
import { zodFieldErrors } from "../../lib/zodFieldErrors";
import { AuthCard } from "./AuthCard";
import { useAuth } from "./AuthContext";
import { FormField } from "./FormField";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      navigate("/login", { state: { justRegistered: true } });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard title="Create an account" subtitle="Start tracking your tasks in a minute.">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
