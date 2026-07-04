import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const { refreshAccessTokenMock, setAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  setAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../lib/apiClient", () => ({
  apiClient: apiClientMock,
  refreshAccessToken: refreshAccessTokenMock,
  setAccessToken: setAccessTokenMock,
}));

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user-name">{auth.user?.name ?? ""}</span>
      <button onClick={() => void auth.login({ email: "ada@example.com", password: "password1" })}>
        login
      </button>
      <button onClick={() => void auth.logout()}>logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("resolves to unauthenticated when there is no valid refresh session", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  });

  it("restores an authenticated session on load when refresh and /me both succeed", async () => {
    refreshAccessTokenMock.mockResolvedValue(true);
    apiClientMock.get.mockResolvedValue({
      user: { id: "1", email: "ada@example.com", name: "Ada" },
      roles: ["USER"],
      permissions: ["task:create"],
    });

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user-name")).toHaveTextContent("Ada");
  });

  it("falls back to unauthenticated if /me fails after a successful refresh", async () => {
    refreshAccessTokenMock.mockResolvedValue(true);
    apiClientMock.get.mockRejectedValue(new Error("boom"));

    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  });

  it("login stores the access token and loads the session", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    apiClientMock.post.mockResolvedValue({
      accessToken: "token",
      user: { id: "1", email: "ada@example.com", name: "Ada" },
    });
    apiClientMock.get.mockResolvedValue({
      user: { id: "1", email: "ada@example.com", name: "Ada" },
      roles: ["USER"],
      permissions: [],
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    const user = userEvent.setup();
    await user.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(setAccessTokenMock).toHaveBeenCalledWith("token");
  });

  it("logout clears the access token and session state even if the request fails", async () => {
    refreshAccessTokenMock.mockResolvedValue(true);
    apiClientMock.get.mockResolvedValue({
      user: { id: "1", email: "ada@example.com", name: "Ada" },
      roles: ["USER"],
      permissions: [],
    });
    apiClientMock.post.mockRejectedValue(new Error("network error"));

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    const user = userEvent.setup();
    await user.click(screen.getByText("logout"));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(setAccessTokenMock).toHaveBeenCalledWith(null);
  });

  it("throws when useAuth is called outside an AuthProvider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within AuthProvider");

    consoleErrorSpy.mockRestore();
  });
});
