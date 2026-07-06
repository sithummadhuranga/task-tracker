import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserDrawer } from "../../../src/features/admin/UserDrawer";
import type { PermissionCatalogEntry, RoleSummary, UserDetail } from "../../../src/features/admin/admin.api";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock };
});

const USER_DETAIL: UserDetail = {
  user: {
    id: "user-1",
    email: "ada@example.com",
    name: "Ada Lovelace",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  roles: ["USER"],
  overrides: [{ id: "override-1", permissionKey: "task:delete:any", effect: "DENY" }],
};

const ROLES: RoleSummary[] = [
  { id: "role-user", name: "USER", isSystem: true, createdAt: "2026-01-01", permissionKeys: [] },
  { id: "role-editor", name: "EDITOR", isSystem: false, createdAt: "2026-01-02", permissionKeys: [] },
];

const CATALOG: PermissionCatalogEntry[] = [
  { id: "perm-1", key: "task:delete:any" },
  { id: "perm-2", key: "user:manage" },
];

function mockDetailEndpoints(): void {
  apiClientMock.get.mockImplementation((path: string) => {
    if (path === "/users/user-1") return Promise.resolve(USER_DETAIL);
    if (path === "/roles") return Promise.resolve(ROLES);
    if (path === "/permissions") return Promise.resolve(CATALOG);
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

function renderDrawer(userId: string | null, onClose: () => void = vi.fn()) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <UserDrawer userId={userId} onClose={onClose} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("UserDrawer", () => {
  it("loads and renders the user's name, roles, and overrides", async () => {
    mockDetailEndpoints();
    renderDrawer("user-1");

    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Assign USER")).toBeChecked();
    expect(screen.getByLabelText("Assign EDITOR")).not.toBeChecked();
    expect(screen.getByText("task:delete:any")).toBeInTheDocument();
  });

  it("assigns a role via POST /users/:id/roles, keeping the user's existing roles", async () => {
    mockDetailEndpoints();
    apiClientMock.post.mockResolvedValue(undefined);
    renderDrawer("user-1");
    await screen.findByRole("heading", { name: "Ada Lovelace" });

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Assign EDITOR"));

    expect(apiClientMock.post).toHaveBeenCalledWith("/users/user-1/roles", {
      roleIds: ["role-user", "role-editor"],
    });
  });

  it("adds a permission override via POST /users/:id/permissions", async () => {
    mockDetailEndpoints();
    apiClientMock.post.mockResolvedValue(undefined);
    renderDrawer("user-1");
    await screen.findByRole("heading", { name: "Ada Lovelace" });

    // task:delete:any is already overridden, so only user:manage is offered.
    const keySelect = screen.getAllByRole("combobox")[0];
    if (!keySelect) {
      throw new Error("expected the permission select to be rendered");
    }
    const user = userEvent.setup();
    await user.selectOptions(keySelect, "user:manage");
    await user.click(screen.getByRole("button", { name: "Add override" }));

    expect(apiClientMock.post).toHaveBeenCalledWith("/users/user-1/permissions", {
      permissionKey: "user:manage",
      effect: "GRANT",
    });
  });

  it("removes a permission override via DELETE /users/:id/permissions/:overrideId", async () => {
    mockDetailEndpoints();
    apiClientMock.delete.mockResolvedValue(undefined);
    renderDrawer("user-1");
    await screen.findByRole("heading", { name: "Ada Lovelace" });

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Remove override for task:delete:any"));

    expect(apiClientMock.delete).toHaveBeenCalledWith("/users/user-1/permissions/override-1");
  });

  it("force-logs-out a user after confirming", async () => {
    mockDetailEndpoints();
    apiClientMock.post.mockResolvedValue(undefined);
    renderDrawer("user-1");
    await screen.findByRole("heading", { name: "Ada Lovelace" });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Force logout everywhere" }));
    await user.click(screen.getByRole("button", { name: "Force logout" }));

    expect(apiClientMock.post).toHaveBeenCalledWith("/users/user-1/logout-all");
  });
});
