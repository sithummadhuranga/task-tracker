import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

// Mock data to demonstrate the UI structure — the real task board lands with the tasks feature.
const MOCK_TASKS = [
  { id: "1", title: "Finalize Q3 architecture review", status: "TODO", dueDate: "Oct 24", owner: "SM" },
  { id: "2", title: "Migrate database to provisioned IOPS", status: "IN_PROGRESS", dueDate: "Oct 25", owner: "SM" },
  { id: "3", title: "Deprecate legacy authentication endpoints", status: "DONE", dueDate: "Oct 20", owner: "JD" },
] as const;

const STATUS_LABEL: Record<(typeof MOCK_TASKS)[number]["status"], string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const STATUS_CLASSES: Record<(typeof MOCK_TASKS)[number]["status"], string> = {
  TODO: "bg-surface-2 text-muted",
  IN_PROGRESS: "bg-primary/15 text-primary",
  DONE: "bg-success/15 text-success",
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-ink">
              T
            </span>
            <span className="hidden sm:inline">Task Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {user ? initials(user.name) : ""}
              </span>
              <span className="text-sm text-muted">{user?.name ?? "Anonymous"}</span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-primary/40 hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Your tasks</h1>
            <p className="mt-1 text-sm text-muted">Everything assigned to you, in one place.</p>
          </div>
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus className="h-4 w-4" />
            New task
          </button>
        </div>

        <ul className="divide-y divide-border rounded-2xl border border-border">
          {MOCK_TASKS.map((task) => (
            <li
              key={task.id}
              className="group flex flex-col gap-3 p-4 transition-colors hover:bg-surface sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex items-start gap-3 sm:items-center">
                <input
                  type="checkbox"
                  defaultChecked={task.status === "DONE"}
                  aria-label={`Mark "${task.title}" as done`}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border bg-bg text-primary accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:mt-0"
                />
                <span
                  className={`text-sm font-medium ${task.status === "DONE" ? "text-muted line-through" : "text-ink"}`}
                >
                  {task.title}
                </span>
              </div>

              <div className="flex items-center gap-3 pl-7 sm:pl-0">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[task.status]}`}
                >
                  {STATUS_LABEL[task.status]}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  {task.dueDate}
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-muted">
                  {task.owner}
                </span>
                <div className="ml-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    aria-label={`Edit "${task.title}"`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label={`Delete "${task.title}"`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
