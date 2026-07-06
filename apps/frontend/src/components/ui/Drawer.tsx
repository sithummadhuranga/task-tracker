import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { promoteToastLayer } from "../../lib/toastLayer";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

// A native <dialog> gives focus-trapping and Escape-to-close for free — styled here as a
// right-side slide-over instead of the default centered modal. Entrance/exit motion lives in
// index.css via @starting-style so it degrades to an instant show/hide in unsupported browsers
// rather than breaking.
export function Drawer({ isOpen, onClose, title, description, children }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
      promoteToastLayer();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      className="drawer-panel m-0 ml-auto h-dvh max-h-none w-full max-w-md border-l border-border bg-surface p-0 text-ink backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </dialog>
  );
}
