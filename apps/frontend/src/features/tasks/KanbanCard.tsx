import { Calendar } from "lucide-react";
import type { DragEvent } from "react";
import { formatDueDate } from "./taskFormatting";
import type { Task } from "./tasks.api";

interface KanbanCardProps {
  task: Task;
  ownerLabel?: string;
  canDrag: boolean;
  onOpen: (task: Task) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, task: Task) => void;
}

export function KanbanCard({ task, ownerLabel, canDrag, onOpen, onDragStart }: KanbanCardProps) {
  return (
    <div
      draggable={canDrag}
      onDragStart={(event) => {
        onDragStart(event, task);
      }}
      role="button"
      tabIndex={0}
      aria-label={`View "${task.title}"`}
      onClick={() => {
        onOpen(task);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task);
        }
      }}
      className={`space-y-2 rounded-xl border border-border bg-bg p-3.5 text-sm transition-colors hover:border-primary/40 ${
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <p className="font-medium text-ink">{task.title}</p>
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          {formatDueDate(task.dueDate)}
        </span>
        {ownerLabel && <span>{ownerLabel}</span>}
      </div>
    </div>
  );
}
