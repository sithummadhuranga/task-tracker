import type { TaskStatus } from "@task-tracker/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AppHeader } from "../../components/ui/AppHeader";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { InlineError } from "../../components/ui/InlineError";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { errorMessage } from "../../lib/errorMessage";
import { useAuth } from "../auth/AuthContext";
import { KanbanBoard } from "./KanbanBoard";
import { canDeleteTask, canEditTask } from "./taskPermissions";
import { TaskDrawer, type TaskDrawerTarget } from "./TaskDrawer";
import { TaskFilters } from "./TaskFilters";
import { TaskTable } from "./TaskTable";
import { deleteTask, fetchTasks, type Task } from "./tasks.api";
import { useTaskRealtimeSync } from "./useTaskRealtimeSync";

const PAGE_SIZE = 10;
type ViewMode = "list" | "board";

export function HomePage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // The route param is the single source of truth for the edit drawer, so a task can be
  // deep-linked, shared, refreshed, or reached via browser back/forward — not just opened from
  // a row click in the current session's in-memory state.
  const { id: routeTaskId } = useParams<{ id?: string }>();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [ownerId, setOwnerId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  // Local-only, not URL-persisted — a page refresh always lands back on List. Documented as a
  // Future Improvement rather than a silent gap.
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const drawerTarget: TaskDrawerTarget = isCreateOpen
    ? { mode: "create" }
    : routeTaskId
      ? { mode: "edit", taskId: routeTaskId }
      : null;

  function closeDrawer(): void {
    setIsCreateOpen(false);
    if (routeTaskId) {
      void navigate("/");
    }
  }

  const canSeeAnyOwner = hasPermission("task:read:any");

  const tasksQuery = useQuery({
    queryKey: ["tasks", "list", { page, status, ownerId }],
    queryFn: () =>
      fetchTasks({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        ownerId: canSeeAnyOwner && ownerId ? ownerId : undefined,
      }),
    enabled: viewMode === "list",
  });

  useTaskRealtimeSync(drawerTarget?.mode === "edit" ? drawerTarget.taskId : undefined);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      toast.success("Task deleted");
      setTaskPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
      setTaskPendingDelete(null);
    },
  });

  function isTaskEditable(task: Task): boolean {
    return canEditTask(task, user?.id, hasPermission);
  }

  function isTaskDeletable(task: Task): boolean {
    return canDeleteTask(task, user?.id, hasPermission);
  }

  function openTask(task: Task): void {
    void navigate(`/tasks/${task.id}`);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader active="tasks" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Your tasks</h1>
            <p className="mt-1 text-sm text-muted">Everything assigned to you, in one place.</p>
          </div>
          {hasPermission("task:create") && (
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Plus className="h-4 w-4" />
              New task
            </button>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <TaskFilters
            status={status}
            ownerId={ownerId}
            canFilterByOwner={canSeeAnyOwner}
            showStatusFilter={viewMode === "list"}
            onApply={(nextStatus, nextOwnerId) => {
              setStatus(nextStatus);
              setOwnerId(nextOwnerId);
              setPage(1);
            }}
          />

          <div className="flex shrink-0 gap-1 rounded-xl border border-border p-1" role="tablist" aria-label="Task view">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "list"}
              onClick={() => {
                setViewMode("list");
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "board"}
              onClick={() => {
                setViewMode("board");
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "board" ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              Board
            </button>
          </div>
        </div>

        {viewMode === "board" && (
          <KanbanBoard
            ownerId={ownerId}
            showOwnerColumn={canSeeAnyOwner}
            currentUserId={user?.id}
            canEditTaskFn={isTaskEditable}
            onOpenTask={openTask}
          />
        )}

        {viewMode === "list" && tasksQuery.isPending && (
          <TableSkeleton rows={PAGE_SIZE} columns={canSeeAnyOwner ? 4 : 3} />
        )}

        {viewMode === "list" && tasksQuery.isError && (
          <InlineError message="Couldn't load tasks." onRetry={() => void tasksQuery.refetch()} />
        )}

        {viewMode === "list" && tasksQuery.data && (
          <div className="space-y-4">
            <TaskTable
              tasks={tasksQuery.data.data}
              showOwnerColumn={canSeeAnyOwner}
              currentUserId={user?.id}
              canDelete={isTaskDeletable}
              onOpenTask={openTask}
              onDeleteRequest={(task) => {
                setTaskPendingDelete(task);
              }}
            />

            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                {tasksQuery.data.meta.total === 0
                  ? "No tasks"
                  : `Showing ${(tasksQuery.data.meta.page - 1) * tasksQuery.data.meta.limit + 1}–${Math.min(tasksQuery.data.meta.page * tasksQuery.data.meta.limit, tasksQuery.data.meta.total)} of ${tasksQuery.data.meta.total}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={tasksQuery.data.meta.page <= 1}
                  onClick={() => {
                    setPage((current) => current - 1);
                  }}
                  aria-label="Previous page"
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2">
                  Page {tasksQuery.data.meta.page} of {tasksQuery.data.meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={tasksQuery.data.meta.page >= tasksQuery.data.meta.totalPages}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                  aria-label="Next page"
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <TaskDrawer target={drawerTarget} onClose={closeDrawer} />

      <ConfirmDialog
        isOpen={taskPendingDelete !== null}
        title={`Delete "${taskPendingDelete?.title ?? "task"}"?`}
        description="This cannot be undone."
        confirmLabel="Delete task"
        tone="danger"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => {
          if (taskPendingDelete) {
            deleteMutation.mutate(taskPendingDelete.id);
          }
        }}
        onCancel={() => {
          setTaskPendingDelete(null);
        }}
      />
    </div>
  );
}
