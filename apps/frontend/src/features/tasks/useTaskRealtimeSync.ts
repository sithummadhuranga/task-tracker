import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { disconnectTaskSocket, subscribeToTaskEvents, type TaskEventTask } from "../../lib/socketClient";

// Invalidates the task list on every event, and the detail query too when the event's task is
// the one currently open. `activeTaskId` is the task backing the open edit drawer, which
// HomePage derives from the /tasks/:id route param.
export function useTaskRealtimeSync(activeTaskId?: string): void {
  const { status } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== "authenticated") {
      disconnectTaskSocket();
      return;
    }

    function invalidateForTask(task: TaskEventTask): void {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
      if (activeTaskId && task.id === activeTaskId) {
        void queryClient.invalidateQueries({ queryKey: ["tasks", "detail", activeTaskId] });
      }
    }

    // Also fires on the very first connect, which is a harmless no-op invalidation against an
    // empty cache — kept as the single reconnect-safety-net path rather than adding a second
    // mechanism for "already connected once before".
    function invalidateCurrentView(): void {
      void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
      if (activeTaskId) {
        void queryClient.invalidateQueries({ queryKey: ["tasks", "detail", activeTaskId] });
      }
    }

    return subscribeToTaskEvents(invalidateForTask, invalidateCurrentView);
  }, [queryClient, activeTaskId, status]);
}
