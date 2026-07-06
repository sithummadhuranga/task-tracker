import type { TaskStatus } from "@task-tracker/shared-types";
import type { DragEvent } from "react";
import { KanbanCard } from "./KanbanCard";
import { STATUS_LABEL } from "./taskFormatting";
import type { Task } from "./tasks.api";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  total: number;
  ownerNames: Map<string, string>;
  showOwnerColumn: boolean;
  currentUserId: string | undefined;
  canEditTaskFn: (task: Task) => boolean;
  onOpenTask: (task: Task) => void;
  onDragStartTask: (event: DragEvent<HTMLDivElement>, task: Task) => void;
  onDropTaskId: (taskId: string, status: TaskStatus) => void;
}

export function KanbanColumn({
  status,
  tasks,
  total,
  ownerNames,
  showOwnerColumn,
  currentUserId,
  canEditTaskFn,
  onOpenTask,
  onDragStartTask,
  onDropTaskId,
}: KanbanColumnProps) {
  return (
    <div
      aria-label={`${STATUS_LABEL[status]} column`}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData("text/plain");
        if (taskId) {
          onDropTaskId(taskId, status);
        }
      }}
      className="flex min-w-64 flex-1 flex-col rounded-2xl border border-border bg-surface p-3"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-ink">{STATUS_LABEL[status]}</h3>
        <span className="text-xs text-muted">{tasks.length}</span>
      </div>

      {total > tasks.length && (
        <p className="mb-2 px-1 text-xs text-muted">
          Showing first {tasks.length} of {total}
        </p>
      )}

      <div className="flex-1 space-y-2">
        {tasks.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted">No tasks</p>}
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            canDrag={canEditTaskFn(task)}
            ownerLabel={
              showOwnerColumn ? (task.ownerId === currentUserId ? "You" : (ownerNames.get(task.ownerId) ?? "…")) : undefined
            }
            onOpen={onOpenTask}
            onDragStart={onDragStartTask}
          />
        ))}
      </div>
    </div>
  );
}
