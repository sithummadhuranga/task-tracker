import type { PermissionEffect, PermissionKey } from "@task-tracker/shared-types";
import { useState } from "react";

interface AddOverrideFormProps {
  availableKeys: PermissionKey[];
  onAdd: (key: PermissionKey, effect: PermissionEffect) => void;
  isPending: boolean;
}

export function AddOverrideForm({ availableKeys, onAdd, isPending }: AddOverrideFormProps) {
  const [key, setKey] = useState<PermissionKey | "">("");
  const [effect, setEffect] = useState<PermissionEffect>("GRANT");

  if (availableKeys.length === 0) {
    return <p className="text-xs text-muted">Every catalog permission already has an override.</p>;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (key) {
          onAdd(key, effect);
          setKey("");
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <select
        value={key}
        onChange={(event) => {
          setKey(event.target.value as PermissionKey);
        }}
        disabled={isPending}
        className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="" disabled>
          Choose permission
        </option>
        {availableKeys.map((availableKey) => (
          <option key={availableKey} value={availableKey}>
            {availableKey}
          </option>
        ))}
      </select>
      <select
        value={effect}
        onChange={(event) => {
          setEffect(event.target.value as PermissionEffect);
        }}
        disabled={isPending}
        className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="GRANT">Grant</option>
        <option value="DENY">Deny</option>
      </select>
      <button
        type="submit"
        disabled={!key || isPending}
        className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Add override
      </button>
    </form>
  );
}
