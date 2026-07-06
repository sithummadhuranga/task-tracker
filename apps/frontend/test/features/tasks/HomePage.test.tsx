import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/features/auth/AuthContext";
import { HomePage } from "../../../src/features/tasks/HomePage";

const { refreshAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock, refreshAccessToken: refreshAccessTokenMock };
});

// HomePage always wires up real-time sync on mount, which would otherwise try a real
// socket.io-client connection under jsdom — stubbed to a no-op spy socket instead.
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({ on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: false })),
}));

const OWN_USER = { id: "user-1", email: "ada@example.com", name: "Ada Lovelace" };

function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "task-1",
    title: "Write report",
    status: "TODO",
    dueDate: "2026-08-01T00:00:00.000Z",
    ownerId: OWN_USER.id,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function taskPage(
  data: unknown[],
  meta: Partial<{ page: number; total: number; totalPages: number }> = {},
) {
  return {
    data,
    meta: { page: meta.page ?? 1, limit: 10, total: meta.total ?? data.length, totalPages: meta.totalPages ?? 1 },
  };
}

function renderHomePage(permissions: string[], onGet?: (path: string) => unknown, initialPath = "/") {
  refreshAccessTokenMock.mockResolvedValue(true);
  apiClientMock.get.mockImplementation((path: string) => {
    if (path === "/auth/me") {
      return Promise.resolve({ user: OWN_USER, roles: ["USER"], permissions });
    }
    // OwnerPicker (owner filter) and TaskTable (owner column) both resolve names through
    // this endpoint whenever they're rendered — an empty result is enough here.
    if (path.startsWith("/users/lookup")) {
      return Promise.resolve([]);
    }
    return Promise.resolve(onGet ? onGet(path) : taskPage([]));
  });

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <Routes>
            <Route path="/tasks/:id" element={<HomePage />} />
            <Route path="/" element={<HomePage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("HomePage", () => {
  it("renders the fetched task list", async () => {
    renderHomePage(["task:create", "task:read:own"], () => taskPage([makeTask()]));

    expect(await screen.findByText("Write report")).toBeInTheDocument();
    // "To do" also appears as a status-filter option — scoped to the table to avoid ambiguity.
    expect(within(screen.getByRole("table")).getByText("To do")).toBeInTheDocument();
  });

  it("requests the next page when Next is clicked", async () => {
    renderHomePage(["task:create", "task:read:own"], (path) => {
      if (path === "/tasks?page=2&limit=10") {
        return taskPage([makeTask({ id: "task-2", title: "Second page task" })], { page: 2, total: 11, totalPages: 2 });
      }
      return taskPage([makeTask({ title: "First page task" })], { page: 1, total: 11, totalPages: 2 });
    });

    await screen.findByText("First page task");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Second page task")).toBeInTheDocument();
    expect(apiClientMock.get).toHaveBeenCalledWith("/tasks?page=2&limit=10");
  });

  it("hides the owner filter and owner column for a caller without task:read:any", async () => {
    renderHomePage(["task:create", "task:read:own"]);

    await screen.findByText("No tasks match these filters.");

    expect(screen.queryByLabelText("Owner")).not.toBeInTheDocument();
  });

  it("shows the owner filter for a caller with task:read:any", async () => {
    renderHomePage(["task:read:any", "task:create"]);

    await screen.findByText("No tasks match these filters.");

    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
  });

  it("hides the New task button for a caller without task:create", async () => {
    renderHomePage(["task:read:own"]);

    await screen.findByText("No tasks match these filters.");

    expect(screen.queryByRole("button", { name: "New task" })).not.toBeInTheDocument();
  });

  it("opens the edit drawer directly when landing on /tasks/:id, e.g. a shared or refreshed link", async () => {
    const task = makeTask({ title: "Deep-linked task" });
    renderHomePage(
      ["task:read:own", "task:update:own"],
      (path) => (path === `/tasks/${task.id}` ? task : taskPage([task])),
      `/tasks/${task.id}`,
    );

    expect(await screen.findByRole("heading", { name: "Task details" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("Deep-linked task")).toBeInTheDocument();
  });

  it("hides the status filter and shows board columns when toggled to Board", async () => {
    renderHomePage(["task:create", "task:read:any"], () => taskPage([]));

    await screen.findByText("No tasks match these filters.");
    expect(screen.getByLabelText("Status")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Board" }));

    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("To do column")).toBeInTheDocument();
    expect(screen.getByLabelText("In progress column")).toBeInTheDocument();
    expect(screen.getByLabelText("Done column")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("returns to the table and pagination when toggled back to List", async () => {
    renderHomePage(["task:create", "task:read:own"], () => taskPage([makeTask()]));

    await screen.findByText("Write report");

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Board" }));
    await screen.findByLabelText("To do column");

    await user.click(screen.getByRole("tab", { name: "List" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("navigates back to / when the drawer opened from a route param is closed", async () => {
    const task = makeTask({ title: "Deep-linked task" });
    renderHomePage(
      ["task:read:own", "task:update:own"],
      (path) => (path === `/tasks/${task.id}` ? task : taskPage([task])),
      `/tasks/${task.id}`,
    );

    await screen.findByRole("heading", { name: "Task details" });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close panel" }));

    expect(screen.queryByRole("heading", { name: "Task details" })).not.toBeInTheDocument();
  });
});
