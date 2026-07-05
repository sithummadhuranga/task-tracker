import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../src/lib/apiClient";
import { AuthProvider } from "../../../src/features/auth/AuthContext";
import { LoginPage } from "../../../src/features/auth/LoginPage";
import { RegisterPage } from "../../../src/features/auth/RegisterPage";

const { refreshAccessTokenMock, apiClientMock } = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  apiClientMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../src/lib/apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("../../../src/lib/apiClient")>("../../../src/lib/apiClient");
  return { ...actual, apiClient: apiClientMock, refreshAccessToken: refreshAccessTokenMock };
});

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  values: { name: string; email: string; password: string },
) {
  await user.type(screen.getByLabelText("Name"), values.name);
  await user.type(screen.getByLabelText("Email"), values.email);
  await user.type(screen.getByLabelText("Password"), values.password);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("RegisterPage", () => {
  it("blocks submission and shows a field error for a password with no digit", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    renderRegisterPage();
    await waitFor(() => {
      expect(refreshAccessTokenMock).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await fillAndSubmit(user, { name: "Ada", email: "ada@example.com", password: "onlyletters" });

    expect(await screen.findByTestId("field-password-error")).toBeInTheDocument();
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  it("shows the server error message on a duplicate email", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    apiClientMock.post.mockRejectedValue(new ApiError(409, "email already registered", null));
    renderRegisterPage();
    await waitFor(() => {
      expect(refreshAccessTokenMock).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await fillAndSubmit(user, { name: "Ada", email: "ada@example.com", password: "password1" });

    expect(await screen.findByRole("alert")).toHaveTextContent("email already registered");
  });

  it("registers successfully and redirects to login with a success banner", async () => {
    refreshAccessTokenMock.mockResolvedValue(false);
    apiClientMock.post.mockResolvedValue({
      id: "1",
      email: "ada@example.com",
      name: "Ada",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    renderRegisterPage();
    await waitFor(() => {
      expect(refreshAccessTokenMock).toHaveBeenCalled();
    });

    const user = userEvent.setup();
    await fillAndSubmit(user, { name: "Ada", email: "ada@example.com", password: "password1" });

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText(/account created/i)).toBeInTheDocument();
  });
});
