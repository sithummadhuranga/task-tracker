import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/features/auth/AuthContext";
import { ApiError } from "../../../src/lib/apiClient";
import { TaskDrawer, type TaskDrawerTarget } from "../../../src/features/tasks/TaskDrawer";

const { refreshAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock, refreshAccessToken: refreshAccessTokenMock };
});

const OWN_USER = { id: "user-1", email: "ada@example.com", name: "Ada Lovelace" };

const EXISTING_TASK = {
  id: "task-1",
  title: "Write report",
  description: "Quarterly numbers",
  status: "TODO",
  dueDate: "2026-08-01T12:00:00.000Z",
  ownerId: OWN_USER.id,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function renderDrawer(target: TaskDrawerTarget, permissions: string[]) {
  refreshAccessTokenMock.mockResolvedValue(true);
  apiClientMock.get.mockImplementation((path: string) => {
    if (path === "/auth/me") {
      return Promise.resolve({ user: OWN_USER, roles: ["USER"], permissions });
    }
    if (path === `/tasks/${EXISTING_TASK.id}`) {
      return Promise.resolve(EXISTING_TASK);
    }
    // OwnerPicker resolves/searches via this endpoint whenever an owner field is rendered —
    // an empty result is enough for these tests, which only assert the field's presence.
    if (path.startsWith("/users/lookup")) {
      return Promise.resolve([]);
    }
    return Promise.reject(new Error(`unexpected path ${path}`));
  });

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <TaskDrawer target={target} onClose={vi.fn()} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("TaskDrawer", () => {
  it("submits a new task via POST /tasks without an owner field for a caller lacking task:read:any", async () => {
    apiClientMock.post.mockResolvedValue({ ...EXISTING_TASK, id: "task-new" });
    const { container } = renderDrawer({ mode: "create" }, ["task:create"]);

    expect(await screen.findByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Owner")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Title"), "Buy milk");
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-08-05T10:00" } });

    // Bypasses the browser's native required-field submit gate (jsdom's datetime-local
    // constraint validation is unreliable) rather than clicking the submit button directly.
    const form = container.querySelector("form");
    if (!form) {
      throw new Error("expected the task form to be rendered");
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(apiClientMock.post).toHaveBeenCalledWith("/tasks", {
        title: "Buy milk",
        description: "",
        status: "TODO",
        dueDate: new Date("2026-08-05T10:00").toISOString(),
        ownerId: undefined,
      });
    });
  });

  it("shows an owner field on create for a caller with task:read:any", async () => {
    renderDrawer({ mode: "create" }, ["task:create", "task:read:any"]);

    expect(await screen.findByRole("heading", { name: "New task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
  });

  it("opens an edit target into a read-only detail view, not straight into the form", async () => {
    renderDrawer({ mode: "edit", taskId: EXISTING_TASK.id }, ["task:update:own"]);

    expect(await screen.findByRole("heading", { name: "Task details" })).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("shows no Edit button for a caller who can view but not edit the task", async () => {
    const otherOwnersTask = { ...EXISTING_TASK, ownerId: "someone-else" };
    apiClientMock.get.mockImplementation((path: string) => {
      if (path === "/auth/me") {
        return Promise.resolve({ user: OWN_USER, roles: ["USER"], permissions: ["task:read:any"] });
      }
      if (path === `/tasks/${otherOwnersTask.id}`) {
        return Promise.resolve(otherOwnersTask);
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
    refreshAccessTokenMock.mockResolvedValue(true);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <TaskDrawer target={{ mode: "edit", taskId: otherOwnersTask.id }} onClose={vi.fn()} />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Task details" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("clicking Edit reveals the pre-filled form, and the owner field only for task:update:any", async () => {
    renderDrawer({ mode: "edit", taskId: EXISTING_TASK.id }, ["task:update:own"]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("heading", { name: "Edit task" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Write report")).toBeInTheDocument();
    expect(screen.queryByLabelText("Owner")).not.toBeInTheDocument();
  });

  it("shows an owner field in edit mode for a caller with task:update:any", async () => {
    renderDrawer({ mode: "edit", taskId: EXISTING_TASK.id }, ["task:update:any"]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    expect(await screen.findByDisplayValue("Write report")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
  });

  it("Cancel discards the draft and returns to the read-only view without closing the drawer", async () => {
    renderDrawer({ mode: "edit", taskId: EXISTING_TASK.id }, ["task:update:own"]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const titleInput = await screen.findByDisplayValue("Write report");
    await user.clear(titleInput);
    await user.type(titleInput, "Something else entirely");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Task details" })).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
    expect(screen.queryByText("Something else entirely")).not.toBeInTheDocument();

    // Re-entering edit mode should show the original value, not the discarded draft.
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByDisplayValue("Write report")).toBeInTheDocument();
  });

  it("shows a generic not-found state for a 404 (missing task or unauthorized-and-not-owner)", async () => {
    refreshAccessTokenMock.mockResolvedValue(true);
    apiClientMock.get.mockImplementation((path: string) => {
      if (path === "/auth/me") {
        return Promise.resolve({ user: OWN_USER, roles: ["USER"], permissions: ["task:update:own"] });
      }
      return Promise.reject(new ApiError(404, "not found", null));
    });

    render(
      // Retries disabled — a 404 is never going to succeed, and the default 3-retry backoff
      // would otherwise leave this query "pending" well past the test's wait timeout.
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <TaskDrawer target={{ mode: "edit", taskId: "missing-task" }} onClose={vi.fn()} />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Task not found.")).toBeInTheDocument();
  });
});
