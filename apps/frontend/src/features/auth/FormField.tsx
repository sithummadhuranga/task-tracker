import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
}

export function FormField({
  label,
  value,
  onChange,
  type = "text",
  error,
  autoComplete,
  disabled,
}: FormFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (isPasswordVisible ? "text" : "password") : type;
  const inputId = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error !== undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-xl border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-50 ${
            isPassword ? "pr-10" : ""
          } ${
            error
              ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/25"
              : "border-border focus:border-primary focus:ring-2 focus:ring-primary/25"
          }`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsPasswordVisible((visible) => !visible);
            }}
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-ink"
          >
            {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} data-testid={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
