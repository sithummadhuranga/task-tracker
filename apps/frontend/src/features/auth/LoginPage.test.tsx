import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/apiClient";
import { AuthProvider } from "./AuthContext";
import { LoginPage } from "./LoginPage";

const { refreshAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("../../lib/apiClient")>("../../lib/apiClient");
  return { ...actual, apiClient: apiClientMock, refreshAccessToken: refreshAccessTokenMock };
});

function renderLoginPage(initialEntry: string | { pathname: string; state?: unknown } = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it("blocks submission and shows a field error for an invalid email", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    renderLoginPage();
    await waitFor(() => expect(refreshAccessTokenMock).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByTestId("field-email-error")).toBeInTheDocument();
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("shows the server error message on invalid credentials", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    apiClientMock.post.mockRejectedValue(new ApiError(401, "invalid credentials", null));
    renderLoginPage();
    await waitFor(() => expect(refreshAccessTokenMock).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid credentials");
  });

  it("logs in and redirects to the originally requested page", async () => {
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

    renderLoginPage();
    await waitFor(() => expect(refreshAccessTokenMock).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("home")).toBeInTheDocument();
  });

  it("shows a success banner after redirecting from registration", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    renderLoginPage({ pathname: "/login", state: { justRegistered: true } });

    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
  });
});
