import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../src/features/auth/AuthContext";
import { RequireAuth } from "../../../src/features/auth/RequireAuth";

const { refreshAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock, refreshAccessToken: refreshAccessTokenMock };
});

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <div>secret</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("RequireAuth", () => {
  it("shows a loading state before the session check resolves", () => {
    refreshAccessTokenMock.mockReturnValue(new Promise(() => undefined));

    renderProtected();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);

    renderProtected();

    expect(await screen.findByText("login page")).toBeInTheDocument();
  });

  it("renders the protected content when authenticated", async () => {
    refreshAccessTokenMock.mockResolvedValue(true);
    apiClientMock.get.mockResolvedValue({
      user: { id: "1", email: "ada@example.com", name: "Ada" },
      roles: [],
      permissions: [],
    });

    renderProtected();

    expect(await screen.findByText("secret")).toBeInTheDocument();
  });
});
