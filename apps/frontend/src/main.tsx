import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { App } from "./App";
import { AuthProvider } from "./features/auth/AuthContext";
import { ApiError } from "./lib/apiClient";
import "./index.css";

// The default retry (3 attempts, exponential backoff) is meant for transient/5xx failures.
// Left at the default, a 403/404 — which is never transient, e.g. a permission that hasn't
// taken effect yet — retries for several seconds before settling, which reads as a UI stuck
// on its loading skeleton rather than a state that already resolved.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          return false;
        }
        return failureCount < 2;
      },
      // The default of 0 means every remount (e.g. closing and reopening the task drawer)
      // refetches even though task/user/role data rarely changes between one interaction and
      // the next — real-time task updates already arrive over the socket and invalidate the
      // relevant query directly (useTaskRealtimeSync.ts), so this window is purely about
      // skipping redundant refetches, not staleness the app depends on.
      staleTime: 30_000,
    },
  },
});
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-xl !border !border-border !bg-surface !text-ink !shadow-lg !shadow-black/20",
                title: "!text-ink !font-medium",
                description: "!text-muted",
                actionButton: "!bg-primary !text-primary-ink",
                cancelButton: "!bg-surface-2 !text-muted",
                error: "!border-danger/40",
                success: "!border-success/40",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
