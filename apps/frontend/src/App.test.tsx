import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function renderAt(path: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App routing", () => {
  it("renders the home placeholder at /", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: "Task Tracker" })).toBeInTheDocument();
  });

  it("renders the login placeholder at /login", () => {
    renderAt("/login");
    expect(screen.getByText(/login screen lands/i)).toBeInTheDocument();
  });

  it("renders the register placeholder at /register", () => {
    renderAt("/register");
    expect(screen.getByText(/registration screen lands/i)).toBeInTheDocument();
  });
});
