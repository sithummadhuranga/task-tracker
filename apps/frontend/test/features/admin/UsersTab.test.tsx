import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsersTab } from "../../../src/features/admin/UsersTab";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock };
});

function pageOf(users: { id: string; email: string; name: string; roles: string[] }[], page: number) {
  return { data: users, meta: { page, limit: 10, total: 11, totalPages: 2 } };
}

function renderUsersTab() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersTab />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("UsersTab", () => {
  it("renders a paginated user list", async () => {
    apiClientMock.get.mockImplementation((path: string) => {
      if (path === "/roles" || path === "/permissions") {
        return Promise.resolve([]);
      }
      return Promise.resolve(
        pageOf([{ id: "user-1", email: "ada@example.com", name: "Ada Lovelace", roles: ["USER"] }], 1),
      );
    });

    renderUsersTab();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("requests the next page when Next is clicked", async () => {
    apiClientMock.get.mockImplementation((path: string) => {
      if (path === "/roles" || path === "/permissions") {
        return Promise.resolve([]);
      }
      if (path === "/users?page=2&limit=10") {
        return Promise.resolve(
          pageOf([{ id: "user-2", email: "grace@example.com", name: "Grace Hopper", roles: ["USER"] }], 2),
        );
      }
      return Promise.resolve(
        pageOf([{ id: "user-1", email: "ada@example.com", name: "Ada Lovelace", roles: ["USER"] }], 1),
      );
    });

    renderUsersTab();
    await screen.findByText("Ada Lovelace");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Grace Hopper")).toBeInTheDocument();
    expect(apiClientMock.get).toHaveBeenCalledWith("/users?page=2&limit=10");
  });
});
