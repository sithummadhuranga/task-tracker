import { motion } from "motion/react";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  heading: string;
  description: string;
  children: ReactNode;
}

export function AuthLayout({ heading, description, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-bg text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, color-mix(in oklch, var(--color-primary) 18%, transparent), transparent 55%), radial-gradient(circle at 85% 85%, color-mix(in oklch, var(--color-accent) 12%, transparent), transparent 50%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-ink">
            T
          </span>
          Task Tracker
        </div>

        <div className="relative z-10 max-w-sm space-y-3">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-ink">
            Tasks, ownership, and permissions that stay in sync.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Every change shows up for the right people immediately — no refresh, no guessing
            who's responsible for what.
          </p>
        </div>

        <p className="relative z-10 text-xs text-muted">Task Tracker</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 text-sm font-semibold tracking-tight lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-ink">
              T
            </span>
            Task Tracker
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-8 rounded-2xl border border-border bg-surface p-8 shadow-lg shadow-black/20 lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none"
          >
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">{heading}</h1>
              <p className="text-sm text-muted">{description}</p>
            </div>

            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
