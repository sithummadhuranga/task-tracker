import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/features/auth/AuthContext";
import { RequirePermission } from "../../../src/features/auth/RequirePermission";

const { refreshAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock, refreshAccessToken: refreshAccessTokenMock };
});

function renderGated(permissions: string[]) {
  refreshAccessTokenMock.mockResolvedValue(true);
  apiClientMock.get.mockResolvedValue({
    user: { id: "1", email: "ada@example.com", name: "Ada" },
    roles: ["USER"],
    permissions,
  });

  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<div>home page</div>} />
          <Route
            path="/admin"
            element={
              <RequirePermission anyOf={["role:manage", "user:manage"]}>
                <div>admin-only content</div>
              </RequirePermission>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("RequirePermission", () => {
  it("redirects away when the caller holds none of the required permissions", async () => {
    renderGated(["task:create", "task:read:own"]);

    expect(await screen.findByText("home page")).toBeInTheDocument();
  });

  it("renders the protected content when the caller holds at least one required permission", async () => {
    renderGated(["user:manage"]);

    expect(await screen.findByText("admin-only content")).toBeInTheDocument();
  });
});
