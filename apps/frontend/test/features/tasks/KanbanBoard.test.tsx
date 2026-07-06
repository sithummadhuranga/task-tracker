import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanBoard } from "../../../src/features/tasks/KanbanBoard";
import type { Task } from "../../../src/features/tasks/tasks.api";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock };
});

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "title" | "status">): Task {
  return {
    dueDate: "2026-08-01T00:00:00.000Z",
    ownerId: "user-1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODO_TASK = makeTask({ id: "task-todo", title: "Todo task", status: "TODO" });
const IN_PROGRESS_TASK = makeTask({ id: "task-in-progress", title: "In progress task", status: "IN_PROGRESS" });
const DONE_TASK = makeTask({ id: "task-done", title: "Done task", status: "DONE" });

function pageOf(tasks: Task[], total = tasks.length) {
  return { data: tasks, meta: { page: 1, limit: 100, total, totalPages: 1 } };
}

function mockColumns(overrides: Partial<Record<"TODO" | "IN_PROGRESS" | "DONE", unknown>> = {}) {
  apiClientMock.get.mockImplementation((path: string) => {
    if (path.includes("status=TODO")) return Promise.resolve(overrides.TODO ?? pageOf([TODO_TASK]));
    if (path.includes("status=IN_PROGRESS")) return Promise.resolve(overrides.IN_PROGRESS ?? pageOf([IN_PROGRESS_TASK]));
    if (path.includes("status=DONE")) return Promise.resolve(overrides.DONE ?? pageOf([DONE_TASK]));
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

// Reused across dragStart/dragOver/drop so getData on drop actually returns what setData
// stored on drag start, same as a real browser drag session.
function createDataTransfer() {
  let stored = "";
  return {
    setData: vi.fn((_format: string, data: string) => {
      stored = data;
    }),
    getData: vi.fn(() => stored),
    effectAllowed: "",
    dropEffect: "",
  };
}

function renderBoard(overrides: Partial<Parameters<typeof KanbanBoard>[0]> = {}) {
  const props = {
    ownerId: "",
    showOwnerColumn: false,
    currentUserId: "user-1",
    canEditTaskFn: () => true,
    onOpenTask: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<QueryClientProvider client={new QueryClient()}><KanbanBoard {...props} /></QueryClientProvider>) };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("KanbanBoard", () => {
  it("renders each task in its matching status column", async () => {
    mockColumns();
    renderBoard();

    expect(await screen.findByText("Todo task")).toBeInTheDocument();
    expect(within(screen.getByLabelText("To do column")).getByText("Todo task")).toBeInTheDocument();
    expect(within(screen.getByLabelText("In progress column")).getByText("In progress task")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Done column")).getByText("Done task")).toBeInTheDocument();
  });

  it("calls onOpenTask when a card is clicked", async () => {
    mockColumns();
    const { props } = renderBoard();

    const user = userEvent.setup();
    await user.click(await screen.findByText("Todo task"));

    expect(props.onOpenTask).toHaveBeenCalledWith(TODO_TASK);
  });

  it("moves a card optimistically on drop, before the PATCH resolves, then settles", async () => {
    mockColumns();
    let resolvePatch: (value: unknown) => void = () => undefined;
    apiClientMock.patch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve;
        }),
    );
    renderBoard();

    const card = await screen.findByRole("button", { name: 'View "Todo task"' });
    const destination = screen.getByLabelText("In progress column");
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(destination, { dataTransfer });
    fireEvent.drop(destination, { dataTransfer });

    // onMutate awaits queryClient.cancelQueries before the mutationFn (and its optimistic cache
    // write) actually run, so both only become observable after a tick — not synchronously
    // after firing the drop event.
    await waitFor(() => {
      expect(apiClientMock.patch).toHaveBeenCalledWith("/tasks/task-todo", { status: "IN_PROGRESS" });
    });
    // Optimistic: the card already shows in the destination column while the patch is in flight.
    expect(within(destination).getByText("Todo task")).toBeInTheDocument();
    expect(within(screen.getByLabelText("To do column")).queryByText("Todo task")).not.toBeInTheDocument();

    resolvePatch(undefined);
    await waitFor(() => {
      expect(apiClientMock.get).toHaveBeenCalled();
    });
  });

  it("rolls the card back to its original column when the PATCH is rejected", async () => {
    mockColumns();
    apiClientMock.patch.mockRejectedValue(new Error("network error"));
    renderBoard();

    const card = await screen.findByRole("button", { name: 'View "Todo task"' });
    const destination = screen.getByLabelText("In progress column");
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(destination, { dataTransfer });
    fireEvent.drop(destination, { dataTransfer });

    await waitFor(() => {
      expect(within(screen.getByLabelText("To do column")).getByText("Todo task")).toBeInTheDocument();
    });
    expect(within(destination).queryByText("Todo task")).not.toBeInTheDocument();
  });

  it("is not draggable for a task the caller can't edit, but is still clickable", async () => {
    mockColumns();
    const { props } = renderBoard({ canEditTaskFn: () => false });

    const card = await screen.findByRole("button", { name: 'View "Todo task"' });
    expect(card).not.toHaveAttribute("draggable", "true");

    const user = userEvent.setup();
    await user.click(card);
    expect(props.onOpenTask).toHaveBeenCalledWith(TODO_TASK);
  });

  it("shows a truncation caveat when a column's total exceeds the fetched count", async () => {
    mockColumns({ TODO: pageOf([TODO_TASK], 150) });
    renderBoard();

    expect(await screen.findByText("Showing first 1 of 150")).toBeInTheDocument();
  });
});
