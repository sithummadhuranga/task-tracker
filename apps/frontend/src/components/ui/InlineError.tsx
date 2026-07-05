interface InlineErrorProps {
  message: string;
  onRetry: () => void;
}

export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <p className="text-sm text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
      >
        Try again
      </button>
    </div>
  );
}
