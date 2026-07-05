import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "default";
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Reserved for genuinely irreversible or high-cost actions (deleting a role, forcing a user's
// sessions out) — not a default reach for every action, per the product register's "modal as
// first thought is usually laziness" guidance.
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  tone = "default",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onCancel();
        }
      }}
      className="confirm-dialog m-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-ink backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            tone === "danger"
              ? "bg-danger text-danger-ink hover:bg-danger/90"
              : "bg-primary text-primary-ink hover:bg-primary/90"
          }`}
        >
          {isConfirming ? "Working..." : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
