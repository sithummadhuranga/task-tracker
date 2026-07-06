import { Calendar, Pencil } from "lucide-react";
import { STATUS_BADGE_CLASSES, STATUS_LABEL, formatDueDate } from "./taskFormatting";
import type { Task } from "./tasks.api";
import { useOwnerNames } from "./useOwnerNames";

interface TaskDetailViewProps {
  task: Task;
  currentUserId: string | undefined;
  canEdit: boolean;
  onEdit: () => void;
}

export function TaskDetailView({ task, currentUserId, canEdit, onEdit }: TaskDetailViewProps) {
  const ownerNames = useOwnerNames([task.ownerId]);
  const ownerLabel = task.ownerId === currentUserId ? "You" : (ownerNames.get(task.ownerId) ?? "…");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-ink">{task.title}</h3>
        <span
          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[task.status]}`}
        >
          {STATUS_LABEL[task.status]}
        </span>
      </div>

      {task.description && (
        <div>
          <h4 className="mb-1.5 text-sm font-medium text-ink">Description</h4>
          <p className="whitespace-pre-wrap text-sm text-muted">{task.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="mb-1.5 font-medium text-ink">Due date</h4>
          <span className="flex items-center gap-1.5 text-muted">
            <Calendar className="h-3.5 w-3.5" />
            {formatDueDate(task.dueDate)}
          </span>
        </div>
        <div>
          <h4 className="mb-1.5 font-medium text-ink">Owner</h4>
          <span className="text-muted">{ownerLabel}</span>
        </div>
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      )}
    </div>
  );
}
