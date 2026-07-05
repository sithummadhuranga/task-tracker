import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { AuthProvider } from "../src/features/auth/AuthContext";

const { refreshAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../src/lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/apiClient")>("../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock, refreshAccessToken: refreshAccessTokenMock };
});

function renderAt(path: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("App routing", () => {
  it("redirects an unauthenticated visitor at / to the login page", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders the home page at / once a session is restored", async () => {
    refreshAccessTokenMock.mockResolvedValue(true);
    apiClientMock.get.mockResolvedValue({
      user: { id: "1", email: "ada@example.com", name: "Ada" },
      roles: ["USER"],
      permissions: [],
    });

    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Your tasks" })).toBeInTheDocument();
  });

  it("renders the login page at /login", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    renderAt("/login");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument(),
    );
  });

  it("renders the register page at /register", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    renderAt("/register");

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument(),
    );
  });
});
