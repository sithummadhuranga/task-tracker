import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoleDrawer } from "../../../src/features/admin/RoleDrawer";
import type { PermissionCatalogEntry, RoleSummary } from "../../../src/features/admin/admin.api";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock };
});

const CATALOG: PermissionCatalogEntry[] = [
  { id: "perm-1", key: "task:create" },
  { id: "perm-2", key: "task:delete:any" },
];

const CUSTOM_ROLE: RoleSummary = {
  id: "role-editor",
  name: "EDITOR",
  isSystem: false,
  createdAt: "2026-01-02",
  permissionKeys: ["task:create"],
};

const SYSTEM_ROLE: RoleSummary = {
  id: "role-user",
  name: "USER",
  isSystem: true,
  createdAt: "2026-01-01",
  permissionKeys: ["task:create"],
};

function renderDrawer(role: RoleSummary | null, onClose: () => void = vi.fn()) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RoleDrawer role={role} catalog={CATALOG} onClose={onClose} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("RoleDrawer", () => {
  it("checks permissions the role already has from the catalog", () => {
    renderDrawer(CUSTOM_ROLE);

    expect(screen.getByLabelText("Grant task:create")).toBeChecked();
    expect(screen.getByLabelText("Grant task:delete:any")).not.toBeChecked();
  });

  it("keeps Save disabled until the name actually changes", () => {
    renderDrawer(CUSTOM_ROLE);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves a renamed role via PATCH /roles/:id once the name changes", async () => {
    apiClientMock.patch.mockResolvedValue(CUSTOM_ROLE);
    renderDrawer(CUSTOM_ROLE);

    const user = userEvent.setup();
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Reviewer");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(apiClientMock.patch).toHaveBeenCalledWith("/roles/role-editor", { name: "Reviewer" });
  });

  it("replaces the role's permission set immediately when a checkbox is toggled", async () => {
    apiClientMock.patch.mockResolvedValue(undefined);
    renderDrawer(CUSTOM_ROLE);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Grant task:delete:any"));

    expect(apiClientMock.patch).toHaveBeenCalledWith("/roles/role-editor/permissions", {
      permissionKeys: ["task:create", "task:delete:any"],
    });
  });

  it("protects a system role: name disabled, no Save button, no delete section", () => {
    renderDrawer(SYSTEM_ROLE);

    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete this role" })).not.toBeInTheDocument();
  });

  it("deletes a non-system role after confirming, then closes the drawer", async () => {
    apiClientMock.delete.mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderDrawer(CUSTOM_ROLE, onClose);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete this role" }));
    await user.click(screen.getByRole("button", { name: "Delete role" }));

    expect(apiClientMock.delete).toHaveBeenCalledWith("/roles/role-editor");
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
