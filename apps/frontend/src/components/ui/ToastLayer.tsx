import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { TOAST_LAYER_ID } from "../../lib/toastLayer";

// Hosts Sonner's Toaster inside a manual popover so it can be promoted into the browser's top
// layer — see lib/toastLayer.ts for why that's necessary. popover="manual" elements start
// hidden (display: none via the UA stylesheet) until shown, so this shows itself once on mount;
// Drawer/ConfirmDialog re-promote it after that via promoteToastLayer().
export function ToastLayer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    if (layer && "showPopover" in layer) {
      layer.showPopover();
    }
  }, []);

  return (
    <div ref={ref} id={TOAST_LAYER_ID} popover="manual">
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
    </div>
  );
}
