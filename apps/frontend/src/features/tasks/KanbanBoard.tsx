import { TASK_STATUSES, type TaskStatus } from "@task-tracker/shared-types";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { DragEvent } from "react";
import { toast } from "sonner";
import { InlineError } from "../../components/ui/InlineError";
import { errorMessage } from "../../lib/errorMessage";
import { KanbanColumn } from "./KanbanColumn";
import { fetchTasks, updateTask, type PaginatedTasks, type Task } from "./tasks.api";
import { useOwnerNames } from "./useOwnerNames";

// The API's own max — a board fetches every matching task per column in one page rather than
// paginating within a column (that's not how Kanban boards read), so this is the practical
// ceiling on how many cards a single column shows before the "showing first N of total" caveat
// in KanbanColumn kicks in.
const BOARD_COLUMN_LIMIT = 100;

interface KanbanBoardProps {
  ownerId: string;
  showOwnerColumn: boolean;
  currentUserId: string | undefined;
  canEditTaskFn: (task: Task) => boolean;
  onOpenTask: (task: Task) => void;
}

function boardQueryKey(status: TaskStatus, ownerId: string): QueryKey {
  return ["tasks", "list", "board", status, { ownerId }];
}

export function KanbanBoard({ ownerId, showOwnerColumn, currentUserId, canEditTaskFn, onOpenTask }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const effectiveOwnerId = ownerId || undefined;

  const todoQuery = useQuery({
    queryKey: boardQueryKey("TODO", ownerId),
    queryFn: () => fetchTasks({ page: 1, limit: BOARD_COLUMN_LIMIT, status: "TODO", ownerId: effectiveOwnerId }),
  });
  const inProgressQuery = useQuery({
    queryKey: boardQueryKey("IN_PROGRESS", ownerId),
    queryFn: () =>
      fetchTasks({ page: 1, limit: BOARD_COLUMN_LIMIT, status: "IN_PROGRESS", ownerId: effectiveOwnerId }),
  });
  const doneQuery = useQuery({
    queryKey: boardQueryKey("DONE", ownerId),
    queryFn: () => fetchTasks({ page: 1, limit: BOARD_COLUMN_LIMIT, status: "DONE", ownerId: effectiveOwnerId }),
  });

  const queriesByStatus = { TODO: todoQuery, IN_PROGRESS: inProgressQuery, DONE: doneQuery } as const;

  function findTask(taskId: string): { task: Task; status: TaskStatus } | undefined {
    for (const status of TASK_STATUSES) {
      const task = queriesByStatus[status].data?.data.find((candidate) => candidate.id === taskId);
      if (task) {
        return { task, status };
      }
    }
    return undefined;
  }

  const moveMutation = useMutation({
    mutationFn: (vars: { id: string; to: TaskStatus }) => updateTask(vars.id, { status: vars.to }),
    onMutate: async (vars) => {
      const found = findTask(vars.id);
      if (!found || found.status === vars.to) {
        return {};
      }

      const fromKey = boardQueryKey(found.status, ownerId);
      const toKey = boardQueryKey(vars.to, ownerId);
      await queryClient.cancelQueries({ queryKey: fromKey });
      await queryClient.cancelQueries({ queryKey: toKey });

      const previousFrom = queryClient.getQueryData<PaginatedTasks>(fromKey);
      const previousTo = queryClient.getQueryData<PaginatedTasks>(toKey);

      if (previousFrom) {
        queryClient.setQueryData<PaginatedTasks>(fromKey, {
          ...previousFrom,
          data: previousFrom.data.filter((task) => task.id !== vars.id),
          meta: { ...previousFrom.meta, total: Math.max(previousFrom.meta.total - 1, 0) },
        });
      }
      if (previousTo) {
        queryClient.setQueryData<PaginatedTasks>(toKey, {
          ...previousTo,
          data: [{ ...found.task, status: vars.to }, ...previousTo.data],
          meta: { ...previousTo.meta, total: previousTo.meta.total + 1 },
        });
      }

      return { fromKey, toKey, previousFrom, previousTo };
    },
    onError: (error, _vars, context) => {
      if (context?.fromKey && context.previousFrom) {
        queryClient.setQueryData(context.fromKey, context.previousFrom);
      }
      if (context?.toKey && context.previousTo) {
        queryClient.setQueryData(context.toKey, context.previousTo);
      }
      toast.error(errorMessage(error));
    },
    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "detail", vars.id] });
    },
  });

  function handleDragStart(event: DragEvent<HTMLDivElement>, task: Task): void {
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(taskId: string, toStatus: TaskStatus): void {
    const found = findTask(taskId);
    if (!found || found.status === toStatus || !canEditTaskFn(found.task)) {
      return;
    }
    moveMutation.mutate({ id: taskId, to: toStatus });
  }

  const allOwnerIds = TASK_STATUSES.flatMap((status) => queriesByStatus[status].data?.data.map((task) => task.ownerId) ?? []);
  const ownerNames = useOwnerNames(showOwnerColumn ? allOwnerIds : []);

  if (TASK_STATUSES.some((status) => queriesByStatus[status].isPending)) {
    return <p className="text-sm text-muted">Loading board...</p>;
  }

  const erroredQuery = TASK_STATUSES.map((status) => queriesByStatus[status]).find((query) => query.isError);
  if (erroredQuery) {
    return (
      <InlineError
        message="Couldn't load the board."
        onRetry={() => {
          void todoQuery.refetch();
          void inProgressQuery.refetch();
          void doneQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {TASK_STATUSES.map((status) => {
        const query = queriesByStatus[status];
        return (
          <KanbanColumn
            key={status}
            status={status}
            tasks={query.data?.data ?? []}
            total={query.data?.meta.total ?? 0}
            ownerNames={ownerNames}
            showOwnerColumn={showOwnerColumn}
            currentUserId={currentUserId}
            canEditTaskFn={canEditTaskFn}
            onOpenTask={onOpenTask}
            onDragStartTask={handleDragStart}
            onDropTaskId={handleDrop}
          />
        );
      })}
    </div>
  );
}
