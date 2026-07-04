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
  const inputId = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500 disabled:opacity-50"
      />
      {error && (
        <p data-testid={`${inputId}-error`} className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
