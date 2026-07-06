import { Calendar, Pencil, Trash2 } from "lucide-react";
import { STATUS_BADGE_CLASSES, STATUS_LABEL, formatDueDate } from "./taskFormatting";
import type { Task } from "./tasks.api";
import { useOwnerNames } from "./useOwnerNames";

interface TaskTableProps {
  tasks: Task[];
  showOwnerColumn: boolean;
  currentUserId: string | undefined;
  canEdit: (task: Task) => boolean;
  canDelete: (task: Task) => boolean;
  onEdit: (task: Task) => void;
  onDeleteRequest: (task: Task) => void;
}

export function TaskTable({
  tasks,
  showOwnerColumn,
  currentUserId,
  canEdit,
  canDelete,
  onEdit,
  onDeleteRequest,
}: TaskTableProps) {
  const columnCount = showOwnerColumn ? 5 : 4;
  const ownerNames = useOwnerNames(showOwnerColumn ? tasks.map((task) => task.ownerId) : []);

  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
          <th className="border-b border-border py-2.5 pr-4 font-medium">Title</th>
          <th className="border-b border-border py-2.5 pr-4 font-medium">Status</th>
          <th className="border-b border-border py-2.5 pr-4 font-medium">Due date</th>
          {showOwnerColumn && <th className="border-b border-border py-2.5 pr-4 font-medium">Owner</th>}
          <th className="border-b border-border py-2.5 pr-4 font-medium" />
        </tr>
      </thead>
      <tbody>
        {tasks.length === 0 && (
          <tr>
            <td colSpan={columnCount} className="border-b border-border py-8 text-center text-sm text-muted">
              No tasks match these filters.
            </td>
          </tr>
        )}
        {tasks.map((task) => (
          <tr key={task.id}>
            <td className="border-b border-border py-3 pr-4 align-middle font-medium text-ink">{task.title}</td>
            <td className="border-b border-border py-3 pr-4 align-middle">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[task.status]}`}>
                {STATUS_LABEL[task.status]}
              </span>
            </td>
            <td className="border-b border-border py-3 pr-4 align-middle text-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDueDate(task.dueDate)}
              </span>
            </td>
            {showOwnerColumn && (
              <td className="border-b border-border py-3 pr-4 align-middle text-muted">
                {task.ownerId === currentUserId ? "You" : (ownerNames.get(task.ownerId) ?? "…")}
              </td>
            )}
            <td className="border-b border-border py-3 pr-4 text-right align-middle">
              <div className="flex justify-end gap-1">
                {canEdit(task) && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(task);
                    }}
                    aria-label={`Edit "${task.title}"`}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete(task) && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteRequest(task);
                    }}
                    aria-label={`Delete "${task.title}"`}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
