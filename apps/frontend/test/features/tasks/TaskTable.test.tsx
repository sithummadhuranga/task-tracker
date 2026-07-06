import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskTable } from "../../../src/features/tasks/TaskTable";
import type { Task } from "../../../src/features/tasks/tasks.api";

const TASK: Task = {
  id: "task-1",
  title: "Write report",
  status: "TODO",
  dueDate: "2026-08-01T00:00:00.000Z",
  ownerId: "user-1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function renderTable(overrides: Partial<Parameters<typeof TaskTable>[0]> = {}) {
  const props = {
    tasks: [TASK],
    showOwnerColumn: false,
    currentUserId: "user-1",
    canDelete: () => true,
    onOpenTask: vi.fn(),
    onDeleteRequest: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<QueryClientProvider client={new QueryClient()}><TaskTable {...props} /></QueryClientProvider>) };
}

describe("TaskTable", () => {
  it("opens the task when the row is clicked", async () => {
    const { props } = renderTable();

    const user = userEvent.setup();
    await user.click(screen.getByText("Write report"));

    expect(props.onOpenTask).toHaveBeenCalledWith(TASK);
  });

  it("opens the task on Enter when the row is focused", async () => {
    const { props } = renderTable();

    screen.getByRole("button", { name: 'View "Write report"' }).focus();
    const user = userEvent.setup();
    await user.keyboard("{Enter}");

    expect(props.onOpenTask).toHaveBeenCalledWith(TASK);
  });

  it("does not open the row when the delete button is clicked", async () => {
    const { props } = renderTable();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Delete "Write report"'));

    expect(props.onDeleteRequest).toHaveBeenCalledWith(TASK);
    expect(props.onOpenTask).not.toHaveBeenCalled();
  });

  it("is still openable for a caller without delete rights on that task, just with no delete button", () => {
    renderTable({ canDelete: () => false });

    expect(screen.getByRole("button", { name: 'View "Write report"' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Delete "Write report"')).not.toBeInTheDocument();
  });
});
