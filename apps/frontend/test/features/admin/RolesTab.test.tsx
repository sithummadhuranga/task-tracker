import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RolesTab } from "../../../src/features/admin/RolesTab";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock };
});

const ROLES = [
  { id: "role-user", name: "USER", isSystem: true, createdAt: "2026-01-01", permissionKeys: ["task:create"] },
  { id: "role-editor", name: "EDITOR", isSystem: false, createdAt: "2026-01-02", permissionKeys: [] },
];
const CATALOG = [
  { id: "perm-1", key: "task:create" },
  { id: "perm-2", key: "task:read:own" },
];

function renderRolesTab() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RolesTab />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("RolesTab", () => {
  it("renders fetched roles with a System badge for system roles", async () => {
    apiClientMock.get.mockImplementation((path: string) => {
      if (path === "/roles") return Promise.resolve(ROLES);
      if (path === "/permissions") return Promise.resolve(CATALOG);
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    renderRolesTab();

    expect(await screen.findByText("USER")).toBeInTheDocument();
    expect(screen.getByText("EDITOR")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("submits a new role name via POST /roles", async () => {
    apiClientMock.get.mockImplementation((path: string) => {
      if (path === "/roles") return Promise.resolve(ROLES);
      if (path === "/permissions") return Promise.resolve(CATALOG);
      return Promise.reject(new Error(`unexpected path ${path}`));
    });
    apiClientMock.post.mockResolvedValue({
      id: "role-new",
      name: "Reviewer",
      isSystem: false,
      createdAt: "2026-01-03",
      permissionKeys: [],
    });

    renderRolesTab();
    await screen.findByText("USER");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New role"), "Reviewer");
    await user.click(screen.getByRole("button", { name: "Create role" }));

    expect(apiClientMock.post).toHaveBeenCalledWith("/roles", { name: "Reviewer" });
  });
});
