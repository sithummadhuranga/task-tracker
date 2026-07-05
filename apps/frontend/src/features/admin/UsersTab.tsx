import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { InlineError } from "../../components/ui/InlineError";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { fetchUsers } from "./admin.api";
import { UserDrawer } from "./UserDrawer";

const PAGE_SIZE = 10;

export function UsersTab() {
  const [page, setPage] = useState(1);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", page],
    queryFn: () => fetchUsers(page, PAGE_SIZE),
  });

  if (usersQuery.isPending) {
    return <TableSkeleton rows={PAGE_SIZE} columns={3} />;
  }

  if (usersQuery.isError) {
    return <InlineError message="Couldn't load users." onRetry={() => void usersQuery.refetch()} />;
  }

  const { data, meta } = usersQuery.data;

  return (
    <div className="space-y-4">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
            <th className="border-b border-border py-2.5 pr-4 font-medium">Name</th>
            <th className="border-b border-border py-2.5 pr-4 font-medium">Email</th>
            <th className="border-b border-border py-2.5 pr-4 font-medium">Roles</th>
            <th className="border-b border-border py-2.5 pr-4 font-medium" />
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="border-b border-border py-8 text-center text-sm text-muted">
                No users on this page.
              </td>
            </tr>
          )}
          {data.map((user) => (
            <tr key={user.id}>
              <td className="border-b border-border py-3 pr-4 align-middle font-medium text-ink">
                {user.name}
              </td>
              <td className="border-b border-border py-3 pr-4 align-middle text-muted">
                {user.email}
              </td>
              <td className="border-b border-border py-3 pr-4 align-middle">
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </td>
              <td className="border-b border-border py-3 pr-4 text-right align-middle">
                <button
                  type="button"
                  onClick={() => {
                    setActiveUserId(user.id);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  Manage
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {meta.total === 0
            ? "No users"
            : `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => {
              setPage((current) => current - 1);
            }}
            aria-label="Previous page"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2">
            Page {meta.page} of {Math.max(meta.totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.totalPages}
            onClick={() => {
              setPage((current) => current + 1);
            }}
            aria-label="Next page"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <UserDrawer
        userId={activeUserId}
        onClose={() => {
          setActiveUserId(null);
        }}
      />
    </div>
  );
}
