import { TASK_STATUSES, type TaskStatus } from "@task-tracker/shared-types";
import { useState } from "react";
import { OwnerPicker } from "./OwnerPicker";
import { STATUS_LABEL } from "./taskFormatting";

interface TaskFiltersProps {
  status: TaskStatus | "";
  ownerId: string;
  canFilterByOwner: boolean;
  onApply: (status: TaskStatus | "", ownerId: string) => void;
}

const FIELD_CLASSES =
  "rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";

export function TaskFilters({ status, ownerId, canFilterByOwner, onApply }: TaskFiltersProps) {
  const [draftStatus, setDraftStatus] = useState<TaskStatus | "">(status);
  const [draftOwnerId, setDraftOwnerId] = useState(ownerId);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draftStatus, draftOwnerId.trim());
      }}
      className="mb-6 flex flex-wrap items-end gap-3"
    >
      <div>
        <label htmlFor="task-status-filter" className="mb-1.5 block text-sm font-medium text-ink">
          Status
        </label>
        <select
          id="task-status-filter"
          value={draftStatus}
          onChange={(event) => {
            setDraftStatus(event.target.value as TaskStatus | "");
          }}
          className={FIELD_CLASSES}
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      {canFilterByOwner && (
        <div className="w-56">
          <label htmlFor="task-owner-filter" className="mb-1.5 block text-sm font-medium text-ink">
            Owner
          </label>
          <OwnerPicker id="task-owner-filter" value={draftOwnerId} onChange={setDraftOwnerId} />
        </div>
      )}

      <button
        type="submit"
        className="rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
      >
        Apply
      </button>
    </form>
  );
}
