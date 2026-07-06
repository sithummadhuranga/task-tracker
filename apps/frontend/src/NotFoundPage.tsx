import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-ink">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="max-w-sm text-sm text-muted">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link
        to="/"
        className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90"
      >
        Back to tasks
      </Link>
    </div>
  );
}
