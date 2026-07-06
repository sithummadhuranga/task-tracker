import { TASK_STATUSES, type TaskStatus } from "@task-tracker/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Sparkles } from "lucide-react";
import { useRef, useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { Drawer } from "../../components/ui/Drawer";
import { InlineError } from "../../components/ui/InlineError";
import { ApiError } from "../../lib/apiClient";
import { errorMessage } from "../../lib/errorMessage";
import { useAuth } from "../auth/AuthContext";
import { SubmitButton } from "../auth/SubmitButton";
import { OwnerPicker } from "./OwnerPicker";
import { STATUS_LABEL, fromDatetimeLocalValue, toDatetimeLocalValue } from "./taskFormatting";
import { canEditTask } from "./taskPermissions";
import { TaskDetailView } from "./TaskDetailView";
import {
  createTask,
  fetchTask,
  magicPolishTask,
  updateTask,
  type CreateTaskBody,
  type Task,
  type UpdateTaskBody,
} from "./tasks.api";

export type TaskDrawerTarget = { mode: "create" } | { mode: "edit"; taskId: string } | null;

interface TaskDrawerProps {
  target: TaskDrawerTarget;
  onClose: () => void;
}

interface DraftState {
  title: string;
  description: string;
  status: TaskStatus;
  dueDateLocal: string;
  ownerId: string;
  version: number;
}

// version: 1 is a placeholder for create mode only — the create request never sends it (a new
// task has no prior version to check in against), and edit mode always overwrites it via
// draftFromTask before the form is shown.
const EMPTY_DRAFT: DraftState = {
  title: "",
  description: "",
  status: "TODO",
  dueDateLocal: "",
  ownerId: "",
  version: 1,
};

const FIELD_CLASSES =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

function draftFromTask(task: Task): DraftState {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    dueDateLocal: toDatetimeLocalValue(task.dueDate),
    ownerId: task.ownerId,
    version: task.version,
  };
}

export function TaskDrawer({ target, onClose }: TaskDrawerProps) {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const taskId = target?.mode === "edit" ? target.taskId : null;

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // "view" only ever applies to an edit target — create always starts (and stays) in "edit"
  // since there's nothing yet to show a read-only view of.
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");
  const dueDateRef = useRef<HTMLInputElement>(null);

  // The native calendar-picker-indicator icon is a small click target — showPicker() lets a
  // click anywhere in the field open the same native calendar/time widget, so the field reads
  // as clickable rather than a plain text box the icon happens to sit inside.
  function openDueDatePicker(): void {
    dueDateRef.current?.showPicker();
  }

  const detailQuery = useQuery({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () => {
      if (!taskId) {
        return Promise.reject(new Error("no task selected"));
      }
      return fetchTask(taskId);
    },
    enabled: taskId !== null,
  });

  const targetKey = target === null ? null : target.mode === "create" ? "create" : target.taskId;

  // Adjusting state during render (RoleDrawer/UserDrawer's documented pattern) instead of a
  // useEffect. Unlike those drawers, closing resets `loadedKey` here too — this drawer doubles
  // as the create flow, and a stale draft surviving into the next "New task" open would show
  // leftover text for what the user sees as a brand new task.
  if (target === null) {
    if (loadedKey !== null) {
      setLoadedKey(null);
    }
  } else if (targetKey !== loadedKey) {
    if (target.mode === "create") {
      setDraft(EMPTY_DRAFT);
      setLoadedKey("create");
      setPanelMode("edit");
    } else if (detailQuery.data) {
      setDraft(draftFromTask(detailQuery.data));
      setLoadedKey(target.taskId);
      setPanelMode("view");
    }
  }

  function invalidateTasks(id?: string): void {
    void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "detail", id] });
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateTaskBody) => createTask(body),
    onSuccess: () => {
      toast.success("Task created");
      invalidateTasks();
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; body: UpdateTaskBody }) => updateTask(vars.id, vars.body),
    onSuccess: (_data, vars) => {
      toast.success("Task updated");
      invalidateTasks(vars.id);
      onClose();
    },
    onError: (error: unknown, vars) => {
      // A stale version means someone else changed this task since it was loaded — refetch and
      // fall back to the read-only view instead of leaving the caller's now-outdated draft in
      // the form, where saving again would just hit the same conflict.
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.error("This task was changed elsewhere — showing the latest version.");
        invalidateTasks(vars.id);
        setPanelMode("view");
        return;
      }
      toast.error(errorMessage(error));
    },
  });

  const magicPolishMutation = useMutation({
    mutationFn: () => magicPolishTask({ title: draft.title.trim(), description: draft.description.trim() }),
    onSuccess: (result) => {
      setDraft((prev) => ({ ...prev, title: result.title, description: result.description }));
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const canSetOwnerOnCreate = hasPermission("task:read:any");
  const canSetOwnerOnEdit = hasPermission("task:update:any");
  const showOwnerField = target?.mode === "create" ? canSetOwnerOnCreate : canSetOwnerOnEdit;
  const isPending = createMutation.isPending || updateMutation.isPending;
  const canMagicPolish = draft.title.trim().length > 0 && !isPending;
  const isNotFound =
    target?.mode === "edit" &&
    detailQuery.isError &&
    detailQuery.error instanceof ApiError &&
    detailQuery.error.statusCode === 404;
  const canEditThisTask = detailQuery.data ? canEditTask(detailQuery.data, user?.id, hasPermission) : false;
  const showForm =
    target?.mode === "create" || (target?.mode === "edit" && panelMode === "edit" && Boolean(detailQuery.data));

  function handleCancelEdit(): void {
    if (detailQuery.data) {
      setDraft(draftFromTask(detailQuery.data));
    }
    setPanelMode("view");
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!target) {
      return;
    }

    const dueDate = fromDatetimeLocalValue(draft.dueDateLocal);
    const description = draft.description.trim();

    if (target.mode === "create") {
      const body: CreateTaskBody = {
        title: draft.title.trim(),
        description,
        status: draft.status,
        dueDate,
        ownerId: canSetOwnerOnCreate && draft.ownerId.trim() ? draft.ownerId.trim() : undefined,
      };
      createMutation.mutate(body);
    } else {
      const body: UpdateTaskBody = {
        title: draft.title.trim(),
        description,
        status: draft.status,
        dueDate,
        ownerId: canSetOwnerOnEdit && draft.ownerId.trim() ? draft.ownerId.trim() : undefined,
        version: draft.version,
      };
      updateMutation.mutate({ id: target.taskId, body });
    }
  }

  const drawerTitle =
    target?.mode === "create" ? "New task" : panelMode === "edit" ? "Edit task" : "Task details";

  return (
    <Drawer isOpen={target !== null} onClose={onClose} title={drawerTitle}>
      {target?.mode === "edit" && detailQuery.isPending && <p className="text-sm text-muted">Loading task...</p>}

      {target?.mode === "edit" && detailQuery.isError && (
        <InlineError
          message={isNotFound ? "Task not found." : "Couldn't load this task."}
          onRetry={() => void detailQuery.refetch()}
        />
      )}

      {target?.mode === "edit" && panelMode === "view" && detailQuery.data && (
        <TaskDetailView
          task={detailQuery.data}
          currentUserId={user?.id}
          canEdit={canEditThisTask}
          onEdit={() => {
            setPanelMode("edit");
          }}
        />
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="mb-1.5 block text-sm font-medium text-ink">
              Title
            </label>
            <input
              id="task-title"
              value={draft.title}
              required
              maxLength={200}
              disabled={isPending}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, title: event.target.value }));
              }}
              className={FIELD_CLASSES}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="task-description" className="block text-sm font-medium text-ink">
                Description
              </label>
              <button
                type="button"
                disabled={!canMagicPolish || magicPolishMutation.isPending}
                onClick={() => {
                  magicPolishMutation.mutate();
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {magicPolishMutation.isPending ? "Polishing..." : "Magic Polish"}
              </button>
            </div>
            <textarea
              id="task-description"
              value={draft.description}
              maxLength={2000}
              disabled={isPending}
              rows={4}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, description: event.target.value }));
              }}
              className={`resize-none ${FIELD_CLASSES}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-status" className="mb-1.5 block text-sm font-medium text-ink">
                Status
              </label>
              <select
                id="task-status"
                value={draft.status}
                disabled={isPending}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, status: event.target.value as TaskStatus }));
                }}
                className={FIELD_CLASSES}
              >
                {TASK_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-due-date" className="mb-1.5 block text-sm font-medium text-ink">
                Due date
              </label>
              <div className="relative">
                <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  ref={dueDateRef}
                  id="task-due-date"
                  type="datetime-local"
                  value={draft.dueDateLocal}
                  required
                  disabled={isPending}
                  onChange={(event) => {
                    setDraft((prev) => ({ ...prev, dueDateLocal: event.target.value }));
                  }}
                  onClick={openDueDatePicker}
                  // scheme-dark, not scheme-light-dark: this build ships dark as the only
                  // active runtime theme (no toggle yet per DESIGN.md) — revisit if a light
                  // toggle ships, so the native picker glyph matches whichever theme is live.
                  className={`${FIELD_CLASSES} scheme-dark pl-9`}
                />
              </div>
            </div>
          </div>

          {showOwnerField && (
            <div>
              <label htmlFor="task-owner" className="mb-1.5 block text-sm font-medium text-ink">
                Owner
              </label>
              <OwnerPicker
                id="task-owner"
                value={draft.ownerId}
                disabled={isPending}
                onChange={(ownerId) => {
                  setDraft((prev) => ({ ...prev, ownerId }));
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <SubmitButton
              isSubmitting={isPending}
              label={target.mode === "create" ? "Create task" : "Save changes"}
              loadingLabel="Saving..."
            />
            {target.mode === "edit" && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleCancelEdit}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </Drawer>
  );
}
