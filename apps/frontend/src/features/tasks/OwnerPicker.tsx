import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchUsers, type UserLookupResult } from "./tasks.api";
import { useOwnerNames } from "./useOwnerNames";

interface OwnerPickerProps {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

const SEARCH_DEBOUNCE_MS = 250;

const FIELD_CLASSES =
  "w-full rounded-xl border border-border bg-bg py-2.5 pl-9 pr-9 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

export function OwnerPicker({ id, value, onChange, disabled }: OwnerPickerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // Set directly from the clicked search result, so the field shows a name immediately rather
  // than waiting on a second request to resolve the id it just chose.
  const [selectedUser, setSelectedUser] = useState<UserLookupResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  // Only resolve over the network when `value` didn't come from a selection made right here
  // (e.g. an existing task's owner when the edit drawer first opens) — a value just picked
  // from search already has its name in `selectedUser`, with no round-trip needed.
  const needsResolve = value !== "" && selectedUser?.id !== value;
  const resolvedOwnerNames = useOwnerNames(needsResolve ? [value] : []);
  const currentOwnerName = !value
    ? null
    : selectedUser?.id === value
      ? selectedUser.name
      : (resolvedOwnerNames.get(value) ?? null);

  const searchQuery = useQuery({
    queryKey: ["users", "lookup", "q", debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: isOpen && debouncedQuery.length > 0,
  });

  function openMenu(): void {
    if (!disabled) {
      setIsOpen(true);
    }
  }

  const results = searchQuery.data ?? [];
  const displayValue = isOpen ? query : (currentOwnerName ?? (value ? "Loading..." : ""));

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          disabled={disabled}
          placeholder="Search by name or email — defaults to you"
          onFocus={openMenu}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!isOpen) {
              openMenu();
            }
          }}
          className={FIELD_CLASSES}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSelectedUser(null);
              setQuery("");
            }}
            aria-label="Clear owner"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg shadow-black/20"
        >
          {debouncedQuery === "" && (
            <p className="px-3.5 py-2 text-xs text-muted">Type to search by name or email.</p>
          )}
          {debouncedQuery !== "" && searchQuery.isFetching && (
            <p className="px-3.5 py-2 text-xs text-muted">Searching...</p>
          )}
          {debouncedQuery !== "" && !searchQuery.isFetching && results.length === 0 && (
            <p className="px-3.5 py-2 text-xs text-muted">No matches.</p>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                onChange(user.id);
                setSelectedUser(user);
                setQuery("");
                setIsOpen(false);
              }}
              className="flex w-full flex-col items-start px-3.5 py-2 text-left text-sm transition-colors hover:bg-surface-2"
            >
              <span className="text-ink">{user.name}</span>
              <span className="text-xs text-muted">{user.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
