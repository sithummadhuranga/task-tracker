import { useQuery } from "@tanstack/react-query";
import { lookupUsersByIds } from "./tasks.api";

// Sorted + joined so the query key is stable across renders regardless of array identity or
// item order — otherwise every render with a "new" but equal array would refetch.
function ownerIdsKey(ownerIds: string[]): string {
  return [...new Set(ownerIds)].sort().join(",");
}

export function useOwnerNames(ownerIds: string[]): Map<string, string> {
  const key = ownerIdsKey(ownerIds);

  const query = useQuery({
    queryKey: ["users", "lookup", "ids", key],
    queryFn: () => lookupUsersByIds(key.split(",").filter(Boolean)),
    enabled: key.length > 0,
  });

  const names = new Map<string, string>();
  for (const user of query.data ?? []) {
    names.set(user.id, user.name);
  }
  return names;
}
